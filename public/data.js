
var Data = function(datacache, dispatch){
	this.root = "/files";
	this.recDir = "/files/recent";
	this.datacache = datacache;
	this.dispatch = dispatch;
	this.storage;
};

Data.prototype.init = function(username, service, callback){
	this.storage = new ServiceStorage(username, service);
	this.storage.init(callback);
};

Data.prototype.fetchDirectory = function(dir, callback){
	var folder = this.getCachedItem(dir);
	var fetched = folder.fetched;
	if(dir == this.recDir){
		folder.fetched = true;
	}
	if(folder.fetched && this.datacache[dir]){
		return callback(this.parseData(this.datacache[dir], dir));
	}
	var self = this;
	ajaxWithOpts("/movies/get", "POST", {"dir": dir}, {},
		function(error){
			throw new Error(error);
		},
		function(response){
			if(response.result == "ok"){
				self.datacache[dir] = self.parseData(response.data, dir);
				folder.fetched = true;
				return callback(self.datacache[dir]);
			}
			if(response.result == "fail"){
				if(response.error && response.error.search("ENOENT") > -1){
					self.onErrorCleanup(dir, callback);
					return callback();
				}
			}
			throw new Error(JSON.stringify(response));
		}
	);
};

Data.prototype.onErrorCleanup = function(dir){
	delete this.datacache[dir];
	this.clearTime(dir);
};

Data.prototype.getPath = function(dir){
	var parts = dir.split("/");
	return  parts.slice(0, parts.length - 1).join("/");
};

Data.prototype.getCachedItem = function(dir){
	var path = this.getPath(dir);
	if(this.datacache[path]){
		var mc = this.datacache[path];
		for(var i = 0, l = mc.length; i < l; ++i){
			if(mc[i].dir == dir){
				return mc[i];
			}
		}
	}
	return false;
};

Data.prototype.addCachedItem = function(movie){
	if(!this.datacache[movie.path]){
		this.datacache[movie.path] = [];
	}
	this.datacache[movie.path].push(movie);
}; 

Data.prototype.clearMovie = function(key){
	this.storage.clearOption(key);
};

Data.prototype.storeMovie = function(key, movie){
	if(movie.type == "folder"){
		return;
	}
	this.storage.setOption(key, {
		"filetype": movie.filetype,
		"dir": movie.dir,
		"path": movie.path,
		"image": movie.image,
		"name": movie.name,
		"tab": movie.tab,
		"ts": movie.ts,
		"type": movie.type,
		"details": movie.details
	});
	this.saveTime(movie);
};

Data.prototype.storeScreen = function(movie){
	var self = this;
	var storeImage = function(img){
		var canvas = $(ce("canvas"))
			.attr({
				"width": img.width,
				"height": img.height
			})
			.get(0);
	    var ctx = canvas.getContext("2d");
	    ctx.drawImage(img, 0, 0);
	    var dataString = canvas.toDataURL("image/png");
	    var savedTime = self.getSavedTime(movie);
	    if(dataString && savedTime){
	    	self.storage.setOption("currentScreen", {
				"time": savedTime.time,
				"url": dataString
			});
	    }
		$(img).remove();
	};

	var img = $(ce("img"))
		.attr({
			"src": movie.movieItem.getMovieScreenUrl()
		})
		.on("load", function(){
			storeImage(img);
		})
		.get(0);
	
	$("body")
		.append(img);
};

Data.prototype.getStoredScreen = function(movie){
	var storedImage = this.storage.getOption("currentScreen");
	var savedTime = this.getSavedTime(movie);
	if(savedTime && storedImage && storedImage.time == savedTime.time){
		return storedImage.url;
	}
	this.storage.clearOption("currentScreen");
};

Data.prototype.getStoredMovie = function(key){
	var movie = this.storage.getOption(key);
	if(movie){
		return this.parseData([movie])[0];
	}
}

Data.prototype.storeOption = function(key, value){
	this.storage.setOption(key, value);
};

Data.prototype.getStoredOption = function(key){
	return this.storage.getOption(key);
}

Data.prototype.canSaveTime = function(movie){
	return movie.time >= 60 && movie.movieItem.secondsSinceStart() >= 30;
};

Data.prototype.saveTime = function(movie){
	if(movie.duration && movie.time){
		if(this.canSaveTime(movie)){
			var savedTimes = this.storage.getOption("savedTimes") || {};
			savedTimes[movie.dir] = {
				"time": movie.time,
				"duration": movie.duration
			};
			this.storage.setOption("savedTimes", savedTimes);
			movie.movieItem.isDone();
		}
	}
}

Data.prototype.clearTime = function(dir){
	if(typeof dir == "object"){
		dir = dir.dir;
	}
	var savedTimes = this.storage.getOption("savedTimes");
	if(!savedTimes){
		return;
	}
	delete savedTimes[dir];
	this.storage.setOption("savedTimes", savedTimes);
}

Data.prototype.getSavedTime = function(movie){
	var savedTimes = this.storage.getOption("savedTimes")
	if(!savedTimes){
		return false;
	}
	if(savedTimes[movie.dir]){
		return savedTimes[movie.dir];
	}
}

Data.prototype.setSavedTimeOnMovie = function(movie){
	var timeItem = this.getSavedTime(movie);
	if(timeItem){
		timeItem.time && (movie.time = timeItem.time);
		timeItem.duration && (movie.duration = timeItem.duration);
		movie.movieItem && movie.movieItem.isDone();
	}
}

Data.prototype.hasSavedTime = function(dir){
	var savedTimes = this.storage.getOption("savedTimes")
	if(!savedTimes){
		return false;
	}
	if(savedTimes[dir]){
		return true;
	}
	return false;
}

Data.prototype.saveQueue = function(queue){
	this.storage.setOption("savedQueue", queue);
};

Data.prototype.getDetails = function(movie, callback){
	if(movie.details){
		return callback(movie);
	}
	movie.details = {};
	this.fetchDetails(movie, function(details){
		for(var i in details){
			movie.details[i] = details[i];
		}
		
		callback(movie);
	});
}

Data.prototype.saveRemoteSettings = function(){
	this.storage.saveRemoteStorage();
};

Data.prototype.fetchDetails = function(movie, callback){
	ajaxWithOpts("/movies/details", "POST", {"path": movie.dir}, {}, null, function(response){
		if(response.result == "ok"){
			return callback(response.details);
		}
		throw new Error(JSON.stringify(response));
	});
};

Data.prototype.regenerateThumb = function(path, thumbTime, callback){
	ajaxWithOpts("/movies/regeneratethumb", "GET", {"path": encodeURIComponent(path), "thumbTime": thumbTime}, {}, null, function(response){
		if(response.result == "ok"){
			return callback(response);
		}
		throw new Error(JSON.stringify(response));
	});
};

Data.prototype.parseData = function(data, dir){
	if(!data){
		return;
	}
	
	var returnData = [];
	for(var i = 0, l = data.length; i < l; ++i){
		
		var datum = data[i];
		var cachedItem = this.getCachedItem(datum.dir);
		if(cachedItem){
			datum = cachedItem;
		}

		returnData.push(datum);
		if(datum.mediatype){
			continue;
		}

		if(datum.type == "movie"){
			
			var television = datum.dir.match(/^\/files\/Television/);
			var karaoke = datum.dir.match(/^\/files\/Karaoke/);
			var music = datum.dir.match(/^\/files\/Music/);
			
			//remove extension
			var replaceType = new RegExp("\." + datum.filetype +"$");
			datum.title = datum.name.replace(replaceType, "");
			
			//set initial media type
			datum.mediatype = "movies";
			datum.show = "Movies";
			
			if(television){
				datum.mediatype = "television";
				
				//get episode info
				var seasonEpisode = datum.title.match(/\[.*\]/);
				if(seasonEpisode){
					var s = seasonEpisode[0].match(/S../);
					if(s){
						datum.season = s[0];
					}
					var e = seasonEpisode[0].match(/E.*[^\]]/);
					if(e){
						datum.episode = e[0];
					}
					
					var nameParts = datum.title.split(seasonEpisode);
					datum.show = nameParts[0].trim();
					datum.title = nameParts[1].trim();
				}
			}
			
			if(music){
				datum.mediatype = "music";
				datum.show = "Music";
			}
			
			if(karaoke){
				datum.mediatype = "karaoke";
				datum.show = "Karaoke";
			}else{
				this.setSavedTimeOnMovie(datum);
			}
			
			
			var recent = datum.dir.match(/^\/files\/recent/)
			if(recent){
				datum.mediatype = "recent";
			}
			
			datum.movieItem = new MovieItem(
				datum, this.dispatch
			);
		}
		
		if(!cachedItem){
			this.addCachedItem(datum);
		}
	}
	return returnData;
};