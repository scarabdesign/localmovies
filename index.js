var helpers = require('../utils/helpers.js');
var movies = require('./lib/movies.js');
var async = require("async");

module.exports = function(app, express, auth, storage) {

	var config = app.get("config");
	
	helpers.setServiceInfo(app, "movies", {
		"filedir" : config.movies.localDir
	});

	movies.set({
		"port" : config.server.port,
		"localDir": config.movies.localDir
	});
	movies.setUp(__dirname);

	app.use('/public/movies', express.static(__dirname + '/public'));

	app.post("/movies/auth", function(req, res) {
		res.send({
			"result" : "ok",
			"authed" : auth.authenticate(req, "movies")
		});
	});

	app.get("/movies/isauthed/:un", function(req, res) {
		var un = helpers.getParam("un", req);
		var ip = req.ip;
		var isAu = auth.isAuthed(un, req, "movies", 2);
		res.send({
			"result" : "ok",
			"authed" : isAu
		});
	});

	app.get("/movies/logout/:un", function(req, res) {
		var un = helpers.getParam("un", req);
		auth.logOut(un);
		res.send({
			"result" : "ok"
		});
	});

	app.post("/movies/get", auth.checkAuth, auth.log_1, function(req, res) {
		var dir = helpers.getParam("dir", req);
		movies.getfiles(dir, function(error, fileInfo) {
			if (error)
				return res.send({
					"result" : "fail",
					"error" : error.message
				});

			res.send({
				"result" : "ok",
				"hash" : movies.getHash(dir),
				"data" : fileInfo
			});
		});
	});

	app.get("/movies/getrecent", auth.checkAuth, auth.log_1,
		function(req, res) {
			movies.getRecent(function(error, fileInfo) {
				if (error)
					return res.send({
						"result" : "fail",
						"error" : error.message
					});
				res.send({
					"result" : "ok",
					"hash" : movies.getHash(movies.recentDir),
					"data" : fileInfo
				});
		});
	});
	
	app.get("/movies/screen", auth.checkAuth, auth.log_1, function(req, res) {
		var path = helpers.getParam("p", req);
		var time = helpers.getParam("t", req);
		if(!time || time == "undefined" || time == undefined){
			time = 0;
		}
		movies.getCurrentMovieScreenImage(path, time, res);
	});

	app.get("/movies/regeneratethumb", auth.checkAuth, auth.log_1, function(
			req, res) {
		var path = helpers.getParam("path", req);
		var thumbTime = helpers.getParam("thumbTime", req);
		movies.regenerateThumb(decodeURIComponent(path), thumbTime, function(error) {
			if (error) {
				return console.log("Error", error.toString());
			}

			res.send({
				"result" : "ok"
			});
		});
	});

	app.post("/movies/details", auth.checkAuth, auth.log_1, function(req, res) {
		var path = helpers.getParam("path", req);
		movies.getRemotePublicFileDetails(path, function(error, details) {
			if (error) {
				return console.log("Error", error.toString());
			}

			res.send({
				"result" : "ok",
				"details" : details
			});
		});
	})

	app.get("/movies/:un?",	function(req, res) {
		app.set("views", __dirname + "/views");
		var username = helpers.getParam("un", req);
		var isAu = auth.isAuthed(username, req, "movies", 2);
		var view = app.get("___view")();

		if (isAu) {
			var agent = JSON.stringify(req.headers['user-agent']);
			if (agent.search("Presto") > -1) {
				return res.redirect("/movies_old/" + username);
			}

			return helpers.getFileHashes([
				"player.js", "list.js",
				"data.js", "item.js", 
				"dispatch.js", "video.min.js"
			], __dirname + "/public/",
				function(error, jsFiles) {
					if (error) {
						return res.send({
							"result" : "fail",
							"error" : error.message
						});
					}
					view.showList = true;
					view.un = username;
					storage.getTimestamp(username, "movies", function(error, storageAge) {
						view.ts = new Date().getTime();
						view.jsFiles = jsFiles;
						view.movies = JSON.stringify(movies.files);
						view.agent = agent;
						view.curtains = movies.buildCurtains();
						view.storageAge = storageAge;
						res.render("index.html", view);
						return movies.getInitialFiles(movies.publicBaseDir, function(error) {
							if (error) {
								console.log("Error refreshing recent: ", error.toString());
							}
						});
					});
			});
		}

		view.showForm = true;
		res.render("index.html", view);
	});
};




