var fs = require("fs");
var async = require('async');
var process = require('child_process');
var crypto = require("crypto");

var helpers = require("../../utils/helpers.js");

var logFile;

//var moviefiletypes = {"avi":1, "mp4":1, "mov":1, "mpg":1, "divx":1, "mkv": 1};
var service = "movies";

var moviefiletypes = {"mp4":1, "mkv":1};
var publicBaseDir = "/files";
var publicRecentDir = "/files/recent";
var thumbTime = "00:10:00";
var karaokeThumbTime = "00:1:30";

exports.publicBaseDir = publicBaseDir;
exports.publicRecentDir = publicRecentDir;
exports.thumbTime = thumbTime;
exports.karaokeThumbTime = karaokeThumbTime;
exports.files = {};
exports.hashes = {};

exports.port;
exports.localDir;
exports.rootDir;
exports.imageDir;

exports.set = function(settingObject){
	for(var i in settingObject){
		exports[i] = settingObject[i];
	}
	logFile = service + (exports.port == 80 ? "" : exports.port)  + ".log";
	exports.localRecentDir = exports.localDir + "/recent/";
};

exports.setUp = function(rootDir){
	var self = this;
	this.rootDir = rootDir;
	this.imageDir = rootDir + "/public/images";
	this.getInitialFiles(this.publicBaseDir, function(error){
		if(error){
			return helpers.recordLog("Error: " + error.toString(), logFile);
		}
		self.files[publicBaseDir]
			.reverse()
			.unshift({
				"name": "Newest",
				"title": "Newest",
				"type": "folder",
				"tab": true,
				"dir": self.publicRecentDir
			}
		);
		helpers.recordLog("Movies initialized", logFile);
	});
};

exports.getInitialFiles = function(dir, callback){
	var self = this;
	this.getfiles(dir, function(error, files){
		if(error){
			return callback(error);
		}
		self.findRecent(files, function(error){
			if(error){
				return callback(error);
			}
			
			callback(null, self.files);
		});
	});
};

exports.getRecent = function(callback){
	var self = this;
	this.getInitialFiles(this.publicBaseDir, function(error, recent){
		if(error){
			return callback(error);
		}
		
		callback(null, self.files[self.publicRecentDir]);
	});
};

exports.getRemoteDir = function(dir, filename){
	return dir.replace(this.localDir, this.publicBaseDir) + (filename || "");
};

exports.getLocalDir = function(dir, filename){
	return dir.replace(this.publicBaseDir, this.localDir) + (filename || "");
};

exports.newHash = function(dir, update){
	var directoryHash = crypto.createHash('sha256');
	directoryHash.update(update);
	this.setHash(dir, directoryHash.digest('hex'));
};

exports.setHash = function(path, hash){
	var dir = this.getLocalDir(path);
	this.hashes[dir] = hash;
}

exports.getHash = function(path){
	var dir = this.getLocalDir(path, "/")
	return this.hashes[dir] || false;
};

exports.findRecent = function(files, callback){
	var self = this;
	var recentFiles = [];
	async.each(files, function(file, callback){
		var localDir = self.getLocalDir(file.dir, "/");
		if(localDir == self.localRecentDir){
			return callback();
		}
		
		var ff0 = ' find -L ' + localDir +' -cmin -10080 -type f \\( ';
		var ffx = [];
		for(var i in moviefiletypes){
			ffx.push(' -iname \\*.' + i);
		}
		var ffn = ' \\) -print ';
		var findFunc = ff0 + ffx.join(' -o') + ffn;
		process.exec(findFunc, function(error, stdout, stderr){
			if(error){
				return callback(error);
			}
			var paths = stdout.split(/\n/).filter(function(item){ return !!item.length });
			if(paths.length > 5){
				paths = paths.slice(0, 5);
			}
			async.eachSeries(
				paths,
				function(path, callback) {
					self.setHash(self.determineFilepath(path) + "/", false);
					self.getStat(path, function(error, item){
						if(error){
							return callback(error);
						}
						
						!!item && recentFiles.push(item);
						
						callback();
					});
				}, 
				callback
			);
		});
		
	}, function(error){
		if(error){
			return callback(error);
		}
		
		self.files[self.publicRecentDir] = recentFiles;
		
		callback();
	});
};

exports.getfiles = function getFiles(dir, callback){
	if(this.getHash(dir) && this.files[dir]){
		return callback(null, this.files[dir]);
	}
	var self = this;
	this.walk(dir, function(error, files){
		if(error){
			return callback(error);
		}

		self.files[dir] = files;
		callback(null, files);
	});
};

var naturalSortFunc = function(a, b) {
	function chunkify(t) {
		var tz = [], x = 0, y = -1, n = 0, i, j;

		while (i = (j = t.charAt(x++)).charCodeAt(0)) {
			var m = (i == 46 || (i >=48 && i <= 57));
			if (m !== n) {
				tz[++y] = "";
				n = m;
			}
			tz[y] += j;
		}
		return tz;
	}

	var aa = chunkify(a.toLowerCase());
	var bb = chunkify(b.toLowerCase());

	for (x = 0; aa[x] && bb[x]; x++) {
		if (aa[x] !== bb[x]) {
			var c = Number(aa[x]), d = Number(bb[x]);
			if (c == aa[x] && d == bb[x]) {
				return c - d;
			} else return (aa[x] > bb[x]) ? 1 : -1;
		}
	}

	return aa.length - bb.length;
};

exports.regenerateThumb = function(path, thumbTime, callback){
	var localPath = this.getLocalDir(path);
	var imageName = this.imageDir + "/" + this._getImageName(localPath);
	var dirPath = this.getLocalDir(path);
	var self = this;
	this.deleteImage(imageName, function(error){
		if (error){
			for(var i in error){
				console.log(error[i]);
			}
			
			return callback(error);
		}
		
		self.thumbNailer(dirPath, imageName, thumbTime, function(error){
			if (error){
				return callback(error);
			}
			
			callback();
		});
	});
};

exports.getScreenDir = function(username, callback){
	var path = this.imageDir + "/screens/";
	var dir = path + username;
	fs.stat(dir, function(error, stat){
		if(error){
			if(error.errno == -2){
				fs.mkdirSync(dir);
			}else{
				return callback(error);
			}
		}
		callback(null, dir + "/");
	});
};

exports.getCurrentMovieScreenImage = function(path, time, res){
	var dir = this.getLocalDir(path);
	var spawn = require("child_process").spawn;
	var makeImage = spawn("avconv", ["-ss", time, "-i", dir, "-vf", "scale=w=640:h=-1", "-vframes","1", "-f","image2", "pipe:1"]);
	res.set({
		"Content-Type": "image/png"
	});
	makeImage.stdout.pipe(res);
};

exports.deleteImage = function(imageName, callback){
	fs.unlink(imageName, function(error){
		if(error){
			if(error.errno == -2){
				return callback();
			}
			helpers.recordLog(error, logFile);
		}
		callback();
	});
};

exports.thumbNailer = function(filePath, imageName, thumbTime, callback){
	var spawn = require("child_process").spawn;
	//w = 256  h = 114
	var makeImage = spawn("avconv", ["-ss", thumbTime, "-i", filePath, "-vf", "scale=w=-1:h=144", "-vframes","1", imageName]);
	
	makeImage.stdout.on("data", (data) => {
		if(data.toString().search("No such file or directory") > -1){
			helpers.recordLog("No such file or directory: " + filePath, logFile);
			return callback();
		}
		helpers.recordLog("stdout:" + data, logFile);
	});
	
	makeImage.stderr.on("data", (data) => {
		helpers.recordLog("stdout:" + data, logFile);
	});
	
	makeImage.on("close", function(code){
		helpers.recordLog("Child process exited with code " + code, logFile);
		helpers.recordLog(["thumb created:", imageName, " time:", thumbTime], logFile);
		callback();
	});
};

exports.generateImage = function(filePath, imageName, callback) {
	var self = this;
	var thumbTime = filePath.search(/\/Karaoke/) > -1 ? this.karaokeThumbTime : this.thumbTime;
	fs.stat(imageName, function(error, result) {
		if(error && (error.errno == -2 || error.code == "ENOENT" || error.errno == -20 || error.code == "ENOTDIR")){
			return self.thumbNailer(filePath, imageName, thumbTime, callback);
		}
		callback();
	});
};

exports._getImageName = function(path, extraString){
	var filetype = this.determineFiletype(path);
	var replaceType = new RegExp("\." + filetype +"$");
	var file = ((path.replace(this.localDir, "").replace(replaceType, "")).replace(/\W/g, "")).toLowerCase();
	if(extraString){
		file += (extraString + "").toLowerCase();
	}
	return file + ".png";
};

exports.walk = function walk(dir, callback) {
	var self = this;
	var imageMap = {};
	if(!dir){
		return callback();
	}
	var localDir = this.getLocalDir(dir, "/");
	fs.readdir(localDir, function(error, list) {
		if (error) 
			return callback(error);
		
		if(!list.length){
			return callback(null, []);
		}

		self.newHash(localDir, JSON.stringify(list));
		
		var currentDirectory = [];
		async.eachSeries(list,
			function(file, callback) {
				if(file == "Songs" || file == "AudioBooks"){
					return callback();
				}
				var path = localDir + file;
				self.getStat(path, function(error, item){
					if(error){
						return callback(error);
					}
					
					if(item){
						item.tab = (!!item.tab || dir == self.publicBaseDir);
						currentDirectory.push(item);
					}

					callback();
				});
			}, 
			function(error) {
				if(error){
					return callback(error);
				}
				callback(null, currentDirectory);
			}
		);
	});
};

exports.determineFilename = function(path){
	var parts = path.split("/");
	return parts[parts.length - 1];
};

exports.determineFilepath = function(path){
	var parts = path.split("/");
	return parts.slice(0, parts.length - 1).join("/");
};

exports.determineRemotepath = function(path){
	var filePath = this.determineFilepath(path);
	return this.getRemoteDir(filePath);
};

exports.determineFiletype = function(path){
	var nameParts = this.determineFilename(path).split(".");
	return nameParts[nameParts.length - 1].toLowerCase();
};

exports.getStat = function(path, callback){
	var self = this;
	var item = {
		"name": this.determineFilename(path)
	};
	async.waterfall([
		function(callback){
			fs.stat(path, callback);
		},
		function(stat, callback){
			if (stat && stat.isFile()) {
				var filetype = self.determineFiletype(path);
				if (moviefiletypes[filetype]){
					item.filetype = filetype;
					item.type = "movie";
					item.dir = self.getRemoteDir(path);
					item.image = self._getImageName(path);
					item.ts = stat.birthtime;
					item.path = self.determineRemotepath(path);

					/*
					{ name: 'Billy Joel - Just The Way You Are.mp4',
					  filetype: 'mp4',
					  type: 'movie',
					  dir: '/files/Karaoke/Billy Joel - Just The Way You Are.mp4',
					  image: 'karaokebillyjoeljustthewayyouare.png',
					  ts: 2014-12-10T06:10:57.119Z,
					  path: '/files/Karaoke' }
					 */
					
					return self.generateImage(path, self.imageDir + "/" +  item.image, callback);
				}else{
					item = null;
				}
			}else if (stat && stat.isDirectory()) {
				item.type = "folder";
				item.title = item.name.replace(/\_/g, " ");
				item.dir = self.getRemoteDir(path);
			}else {
				item = null;
			}
			callback();
		}],
		function(error){
			if(error){
				return callback(error);
			}
			
			callback(null, item);
		}
	);
};

exports.getFileDetails = function(localDir, callback){
	var infoFunc = ' exiftool "' + localDir + '"';
	process.exec(infoFunc, function(error, stdout, stderr){
		if(error){
			return callback(error);
		}
		var detailsArray = stdout.split("\n");
		var details = {};
		for(var i = 0, l = detailsArray.length; i < l; ++i){
			var a = detailsArray[i];
			var b = a.split(" : ");
			if(b[0] && b[1]){
				details[b[0].trim()] = b[1].trim()
			}
		}
		callback(null, details);
	});
};

exports.getFileDetail = function(localDir, key, callback){
	this.getFileDetails(localDir, function(error, details){
		if(error){
			return callback(error);
		}
		
		callback(null, details[key]);
	});
};

exports.getRemotePublicFileDetails = function(remotePath, callback){
	var localDir = this.getLocalDir(remotePath);
	this.getPublicFileDetails(localDir, callback);
};

exports.getPublicFileDetails = function(localDir, callback){
	var self = this;
	this.getFileDetails(localDir, function(error, details){
		if(error){
			return callback(error);
		}
		
		var publicDetails = {};
		for(var i = 0, l = publicDetailItems.length; i < l; ++i){
			var key = publicDetailItems[i];
			if(details[key]){
				if(key == "Create Date"){
					publicDetails[key] = self.createDateTimeCascade(details);
				}else{
					publicDetails[key] = details[key];
				}
			}
		}
		callback(null, publicDetails);
	});
};

var publicDetailItems = [
	"File Size", "Create Date", 
	"Duration", "Video Frame Rate", 
	"Audio Channels", "Audio Sample Rate", 
	"Image Width", "Image Height"
];

exports.createDateTimeCascade = function(details){
	var priority = ["Create Date", "Track Create Date", 
		"Media Create Date", "Modify Date", "Track Modify Date", 
		"Media Modify Date", "File Modification Date/Time", 
		"File Access Date/Time", "File Inode Change Date/Time"
	];
	for(var i = 0, l = priority.length; i < l; ++i){
		if(details[priority[i]] && 
			details[priority[i]] != "0000:00:00 00:00:00" && 
			(new Date(details[priority[i]].replace(/:/, '/').replace(/:/, '/')) != "Invalid Date")){
				return details[priority[i]];
		}
	}
};

	/*
{ 'ExifTool Version Number': '9.46',
  'File Name': 'Antichrist (2009).mp4',
  Directory: '/home/administrator/Projects/movies/Files/Movies/Antichrist',
  'File Size': '702 MB',
  'File Modification Date/Time': '2015:12:23 01:00:30-08:00',
  'File Access Date/Time': '2015:12:23 01:06:29-08:00',
  'File Inode Change Date/Time': '2015:12:23 01:06:27-08:00',
  'File Permissions': 'rw-r-----',
  'File Type': 'MP4',
  'MIME Type': 'video/mp4',
  'Major Brand': 'MP4  Base Media v1 [IS0 14496-12:2003]',
  'Minor Version': '0.0.1',
  'Compatible Brands': 'isom, avc1',
  'Movie Header Version': '0',
  'Create Date': '2012:08:19 08:50:18',
  'Modify Date': '2012:08:19 08:50:18',
  'Time Scale': '600',
  Duration: '1:44:00',
  'Preferred Rate': '1',
  'Preferred Volume': '100.00%',
  'Preview Time': '0 s',
  'Preview Duration': '0 s',
  'Poster Time': '0 s',
  'Selection Time': '0 s',
  'Selection Duration': '0 s',
  'Current Time': '0 s',
  'Next Track ID': '3',
  'Track Header Version': '0',
  'Track Create Date': '2012:08:19 08:50:18',
  'Track Modify Date': '2012:08:19 08:51:12',
  'Track ID': '1',
  'Track Duration': '1:44:00',
  'Track Layer': '0',
  'Track Volume': '0.00%',
  'Image Width': '1280',
  'Image Height': '544',
  'Graphics Mode': 'srcCopy',
  'Op Color': '0 0 0',
  'Compressor ID': 'avc1',
  'Source Image Width': '1280',
  'Source Image Height': '544',
  'X Resolution': '72',
  'Y Resolution': '72',
  'Bit Depth': '24',
  'Buffer Size': '354491',
  'Max Bitrate': '7762008',
  'Average Bitrate': '844840',
  'Video Frame Rate': '25',
  'Matrix Structure': '1 0 0 0 1 0 0 0 1',
  'Media Header Version': '0',
  'Media Create Date': '2012:08:19 08:51:06',
  'Media Modify Date': '2012:08:19 08:51:12',
  'Media Time Scale': '48000',
  'Media Duration': '1:44:00',
  'Media Language Code': 'eng',
  'Handler Type': 'Audio Track',
  'Handler Description': 'GPAC ISO Audio Handler',
  Balance: '0',
  'Audio Format': 'mp4a',
  'Audio Channels': '2',
  'Audio Bits Per Sample': '16',
  'Audio Sample Rate': '48000',
  'Movie Data Size': '733334566',
  'Movie Data Offset': '2918500',
  'Avg Bitrate': '940 kbps',
  'Image Size': '1280x544',
  Rotation: '0' }

	 */

exports.buildCurtains = function(){
	var colors = ["600000", "970000", "FA0000"];
	colors = colors.concat(colors.slice().reverse());
	
	var colorString = [], dist = 0;
	for(var i = 0, l = 20; i < l; ++i){
		for(var ii = 0, ll = colors.length; ii < ll; ++ii){
			colorString.push("#" + colors[ii] + " " + dist + "%");
			if(dist == 100){
				break;
			}
			dist += Math.floor(Math.random() * (Math.floor(Math.random() * 3))) + 1;
			if(dist > 100){
				dist = 100;
			}
		}
		if(dist == 100){
			break;
		}
	}
	
	return  "repeating-linear-gradient(90Deg, " + colorString.join(", ") + ")";
};
