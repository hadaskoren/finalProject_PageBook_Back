// Minimal Simple REST API Handler (With MongoDB and Socket.io)
// Plus support for simple login and session
// Plus support for file upload
// Author: Yaron Biton misterBIT.co.il

"use strict";
const express = require('express'),
	bodyParser = require('body-parser'),
	cors = require('cors'),
	mongodb = require('mongodb'),
	ObjectId = mongodb.ObjectID;

const clientSessions = require("client-sessions");
const multer = require('multer')

// Configure where uploaded files are going
const uploadFolder = '/uploads';
var storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, __dirname + uploadFolder);
	},
	filename: function (req, file, cb) {
		cl('file', file);
		const ext = file.originalname.substr(file.originalname.lastIndexOf('.'));
		cb(null, file.fieldname + '-' + Date.now() + ext)
	}
})
var upload = multer({ storage: storage })

const app = express();

var corsOptions = {
	origin: /http:\/\/localhost:\d+/,
	credentials: true
};

const serverRoot = 'http://localhost:3003/';
const baseUrl = serverRoot + 'data';


app.use(express.static('uploads'));
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(clientSessions({
	cookieName: 'session',
	secret: 'C0d1ng 1s fun 1f y0u kn0w h0w', // set this to a long random string!
	duration: 30 * 60 * 1000,
	activeDuration: 5 * 60 * 1000,
}));

const http = require('http').Server(app);
const io = require('socket.io')(http);

function dbConnect() {

	return new Promise((resolve, reject) => {
		// Connection URL
		var url = 'mongodb://localhost:27017/page_book';
		// Use connect method to connect to the Server
		mongodb.MongoClient.connect(url, function (err, db) {
			if (err) {
				cl('Cannot connect to DB', err)
				reject(err);
			}
			else {
				//cl("Connected to DB");
				resolve(db);
			}
		});
	});
}

// GETs a list
app.get('/data/:objType', function (req, res) {
	const objType = req.params.objType;
	dbConnect().then((db) => {
		const collection = db.collection(objType);

		collection.find({}).toArray((err, objs) => {
			if (err) {
				cl('Cannot get you a list of ', err)
				res.json(404, { error: 'not found' })
			} else {
				cl("Returning list of " + objs.length + " " + objType + "s");
				res.json(objs);
			}
			db.close();
		});
	});
});


// GETs partial list of user's sites

function buildQuery(siteIds) {
	let queryObj = {
		$or: []
	}
	siteIds.forEach(siteId => {
		queryObj['$or'].push({ _id: ObjectId(siteId) });
	});
	return queryObj;
}

app.post('/data/sites/list', function (req, res) {
	console.log('sushiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii');
	console.log(req.body);
	const query = buildQuery(req.body);
	console.log(query);
	dbConnect().then((db) => {
		const collection = db.collection('sites');

		collection.find(query, { _id: 1, siteName: 1 }).toArray((err, objs) => {
			if (err) {
				cl('Cannot get you a list of ', err)
				res.json(404, { error: 'not found' })
			} else {
				cl("Returning list of " + objs.length);
				res.json(objs);
			}
			db.close();
		});
	});
});


// GETs a single
app.get('/data/:objType/:id', function (req, res) {
	const objType = req.params.objType;
	const objId = req.params.id;
	console.log('');
	cl(`Getting you an ${objType} with id: ${objId}`);
	dbConnect()
		.then((db) => {
			const collection = db.collection(objType);
			//let _id;
			//try {
			let _id = new mongodb.ObjectID(objId);
			//}
			//catch (e) {
			//	console.log('ERROR', e);
			//	return Promise.reject(e);
			//}

			collection.find({ _id: _id }).toArray((err, objs) => {
				if (err) {
					cl('Cannot get you that ', err)
					res.json(404, { error: 'not found' })
				} else {
					cl("Returning a single " + objType);
					res.json(objs[0]);
				}
				db.close();
			});
		});
});

// DELETE
app.delete('/data/:objType/:id', function (req, res) {
	const objType = req.params.objType;
	const objId = req.params.id;
	cl(`Requested to DELETE the ${objType} with id: ${objId}`);
	dbConnect().then((db) => {
		const collection = db.collection(objType);
		collection.deleteOne({ _id: new mongodb.ObjectID(objId) }, (err, result) => {
			if (err) {
				cl('Cannot Delete', err)
				res.json(500, { error: 'Delete failed' })
			} else {
				cl("Deleted", result);
				res.json({});
			}
			db.close();
		});

	});


});

// POST - adds 
app.post('/data/:objType', upload.single('file'), function (req, res) {
	//console.log('req.file', req.file);
	// console.log('req.body', req.body);

	const objType = req.params.objType;
	cl("POST for " + objType);

	const obj = req.body;
	delete obj._id;
	// If there is a file upload, add the url to the obj
	if (req.file) {
		obj.imgUrl = serverRoot + req.file.filename;
	}

	dbConnect().then((db) => {
		const collection = db.collection(objType);

		collection.insert(obj, (err, result) => {
			if (err) {
				cl(`Couldnt insert a new ${objType}`, err)
				res.json(500, { error: 'Failed to add' })
			} else {
				cl(objType + " added");
				res.json(obj);
				db.close();
			}
		});
	});

});


// SIGNUP


app.post('/signup', function (req, res) {
	console.log('req.body', req.body);


	const obj = req.body;


	dbConnect().then((db) => {
		const collection = db.collection('users');

		collection.insert(obj, (err, result) => {
			if (err) {
				cl(`Couldnt insert a new `, err)
				res.json(500, { error: 'Failed to add' })
			} else {
				cl('user' + " added");
				res.json(obj);
				db.close();
			}
		});
	});

});

function updateUserSitesIds(newId, userInfo, userCollection) {
	console.log('newIddddd', newId);
	console.log('userInfooooooid', userInfo.id);
	userInfo.sitesIds.push(newId + '');
	console.log('hhhhh', userInfo.sitesIds);
	userCollection.findAndModify(
		{
			_id: ObjectId(userInfo.id),
		},
		[['username', 1]],
		{
			$set: {
				siteIds: userInfo.sitesIds
			}
		},
		{ new: true },
		function (err, user) {
			if (user) {
				// cl('Login Succesful');
				// cl(user.value);
				// delete user.password;
				//req.session.user = user;  //refresh the session value
				// res.json(user.value);
			} else {
				// cl('Login NOT Succesful');
				// req.session.user = null;
				// res.json(403, { error: 'Login failed' })
			}
		});
}


// New site
app.post('/newSite', function (req, res) {
	console.log('req.body', req.body);
	const obj = req.body.site;
	dbConnect().then((db) => {
		const collection = db.collection('sites');
		const userCollection = db.collection('users');

		collection.insert(obj, (err, result) => {
			if (err) {
				cl(`Couldnt insert a new `, err)
				res.json(500, { error: 'Failed to add' })
			} else {
				cl('result', result.ops[0]);
				cl('site' + " added");
				updateUserSitesIds(result.ops[0]._id, req.body.userInfo, userCollection);


				res.json(result.ops[0]);
				db.close();
			}
		});
	});

});
// PUT - updates
app.put('/data/:objType/:id', function (req, res) {
	const objType = req.params.objType;
	const objId = req.params.id;
	const newObj = req.body;
	if (newObj._id && typeof newObj._id === 'string') newObj._id = new mongodb.ObjectID(newObj._id);
	console.log('newObj', newObj)
	cl(`Requested to UPDATE the ${objType} with id: ${objId}`);
	dbConnect().then((db) => {
		const collection = db.collection(objType);
		collection.updateOne({ _id: new mongodb.ObjectID(objId) }, newObj,
			(err, result) => {
				if (err) {
					cl('Cannot Update', err)
					res.json(500, { error: 'Update failed' })
				} else {
					res.json(newObj);
				}
				db.close();
			});
	});
});



// let token = {};
// token.timeStamp = Date.now();
// token.id = Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
// return token;

// function updateUserTokenInDB(user, db) {
// 	// const token = createToken();
// 	user.token = createToken()
// 	// console.log(user);
// 	const collection = db.collection('users');
// 	collection.updateOne({ _id: new ObjectId(user._id) }, user,
// 		(err, result) => {
// 			if (err) {
// 				cl('Cannot Update', err)
// 				res.json(500, { error: 'Update failed' })
// 			} else {
// 				// db.close();
// 				return user;
// 				//res.json(user);
// 			}
// 		});
// }

function createToken() {
	let token = {};
	function s4() {
		return Math.floor((1 + Math.random()) * 0x10000)
			.toString(16)
			.substring(1);
	}
	token.id = s4() + s4() + '-' + s4() + '-' + s4() + '-' +
		s4() + '-' + s4() + s4() + s4() + s4() + s4() + '-' + s4() + '-' + s4() + '-' +
		s4() + '-' + s4() + s4() + s4();
	token.timeStamp = Date.now();
	return token;
}


app.post('/token-login', function (req, res) {
	console.log('tokennnnnnnnnnnnnnnnn', req.body.token);
	dbConnect().then((db) => {
		db.collection('users').findOne({ token: req.body.token }, function (err, user) {
			console.log(user);
			if (user) {
				cl('Login Succesful');
				cl(user);
				// user = updateUserTokenInDB(user, db);
				delete user.password;
				req.session.user = user;  //refresh the session value
				res.json({ token: 'Beareloginr: puk115th@b@5t', user });
			} else {
				cl('Login NOT Succesful');
				req.session.user = null;
				res.json(403, { error: 'Login failed' })
			}
		});

	});
});


// Basic Login/Logout/Protected assets
app.post('/login', function (req, res) {
	console.log('req.body.username', req.body.username, '  req.body.password', req.body.password);
	dbConnect().then((db) => {
		// db.collection('users').findOne({ username: req.body.username, password: req.body.password }, function (err, user) {

		// 	if (user) {
		// 		cl('Login Succesful');
		// 		cl(user);
		// 		user = updateUserTokenInDB(user, db);
		// 		delete user.password;
		// 		req.session.user = user;  //refresh the session value
		// 		res.json({ token: 'Beareloginr: puk115th@b@5t', user });
		// 	} else {
		// 		cl('Login NOT Succesful');
		// 		req.session.user = null;
		// 		res.json(403, { error: 'Login failed' })
		// 	}
		// });
		const newToken = createToken();
		db.collection('users').findAndModify(
			{
				username: req.body.username,
				password: req.body.password
			},
			[['username', 1]],
			{
				$set: {
					token: newToken
				}
			},
			{ new: true },
			function (err, user) {
				if (user) {
					cl('Login Succesful');
					cl(user.value);
					delete user.password;
					//req.session.user = user;  //refresh the session value
					res.json(user.value);
				} else {
					cl('Login NOT Succesful');
					req.session.user = null;
					res.json(403, { error: 'Login failed' })
				}
			});
	});
});

app.get('/logout', function (req, res) {
	req.session.reset();
	res.end('Loggedout');
});

function requireLogin(req, res, next) {
	if (!req.session.user) {
		cl('Login Required');
		res.json(403, { error: 'Please Login' })
	} else {
		next();
	}
};
app.get('/protected', requireLogin, function (req, res) {
	res.end('User is loggedin, return some data');
});


// Kickup our server 
// Note: app.listen will not work with cors and the socket
// app.listen(3003, function () {
http.listen(3003, function () {
	console.log(`misterREST server is ready at ${baseUrl}`);
	console.log(`GET (list): \t\t ${baseUrl}/{entity}`);
	console.log(`GET (single): \t\t ${baseUrl}/{entity}/{id}`);
	console.log(`DELETE: \t\t ${baseUrl}/{entity}/{id}`);
	console.log(`PUT (update): \t\t ${baseUrl}/{entity}/{id}`);
	console.log(`POST (add): \t\t ${baseUrl}/{entity}`);

});

io.on('connection', function (socket) {
	console.log('a user connected');
	socket.on('disconnect', function () {
		console.log('user disconnected');
	});
	socket.on('chat message', function (msg) {
		// console.log('message: ' + msg);
		io.emit('chat message', msg);
	});
});

cl('WebSocket is Ready');

// Some small time utility functions
function cl(...params) {
	console.log.apply(console, params);
}

// Just for basic testing the socket

app.get('/', function (req, res) {
	res.sendFile(__dirname + '/test-socket.html');
});

app.post('/upload', function (req, res) {
	console.log('image log', req.files.file.path);
	var tempPath = req.files.file.path,
		targetPath = path.resolve('./uploads/images/image.png');
	if (path.extname(req.files.file.name).toLowerCase() === '.png') {
		fs.rename(tempPath, targetPath, function (err) {
			if (err) throw err;
			console.log("Upload completed!");
		});
	} else {
		fs.unlink(tempPath, function () {
			if (err) throw err;
			console.error("Only .png files are allowed!");
		});
	}
});