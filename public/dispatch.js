
var MovieDispatch = function(datacache){
	this.dataObject = new Data(datacache, this);
	this.index = 0;
	this.username;
	this.player;
};

MovieDispatch.prototype.init = function(username, service, callback){
	this.username = username;
	var self = this;
	this.dataObject.init(username, service, function(){
		self.player = new Player(self.dataObject, self);
		self.setListeners(
			["ended"], self, self.saveRemoteSettings
		);
		callback(self.dataObject.root);
	});
};

MovieDispatch.prototype.saveRemoteSettings = function(){
	this.dataObject.saveRemoteSettings();
};

MovieDispatch.prototype.setListeners = function(events, target, callback){
	this.player.setListeners(events, target, callback);
};

MovieDispatch.prototype.getStoredScreen = function(movie){
	return this.dataObject.getStoredScreen(movie);
};

MovieDispatch.prototype.getSavedTime = function(movie){
	return this.dataObject.getSavedTime(movie);
};

MovieDispatch.prototype.storeScreen = function(movie){
	this.dataObject.storeScreen(movie);
};

MovieDispatch.prototype.getTabIndex = function(){
	return ++this.index;
};

MovieDispatch.prototype.isRecentTab = function(dir){
	return dir == this.dataObject.recDir;
};

MovieDispatch.prototype.getMovieDetails = function(movie, callback){
	this.dataObject.getDetails(movie, callback);
};

MovieDispatch.prototype.queueMoviesAndPlay = function(movies){
	this.player.newQueue(movies);
	this.player.startQueue();
};

MovieDispatch.prototype.fetchDirectory = function(dir, callback){
	this.dataObject.fetchDirectory(dir, function(movies){
		callback(movies || []);
	});
};

MovieDispatch.prototype.fetchDirectoryForItem = function(item, callback){
	if(item.path){
		return this.fetchDirectory(item.path, callback);
	}
	if(item.dir){
		return this.fetchDirectory(item.dir, callback);
	}
};

MovieDispatch.prototype.queueMoviesAndContinue = function(folder){
	var self = this;
	this.fetchDirectoryForItem(folder, function(movies){
		var index = self.getStartedIndexFromList(movies);
		self.queueMoviesAndPlay(movies.slice(index));
	});
};

MovieDispatch.prototype.getStartedIndexFromList = function(list){
	var index = 0;
	for(var i = 0, l = list.length; i < l; ++i){
		var m = list[i];
		if(m.movieItem.isDone()){
			index = i;
		}
	}
	return ++index;
};

MovieDispatch.prototype.getIndexInList = function(movie, list){
	for(var i = 0, l = list.length; i < l; ++i){
		var m = list[i];
		if(m.dir == movie.dir){
			return i;
		}
	}
	return 0;
};

MovieDispatch.prototype.queueSeriesAndPlayNext = function(movie){
	var self = this;
	this.fetchDirectoryForItem(movie, function(movies){
		var index = self.getIndexInList(movie, movies);
		self.queueMoviesAndPlay(movies.slice(index));
	});
};

MovieDispatch.prototype.queueSeriesAndPlayPrev = function(movie){
	var self = this;
	this.fetchDirectoryForItem(movie, function(movies){
		var index = self.getIndexInList(movie, movies) - 1;
		if(index > -1){
			self.queueMoviesAndPlay(movies.slice(index));
		}
	});
};

MovieDispatch.prototype.queueMoviesAndPlayAll = function(folder){
	var self = this;
	this.fetchDirectoryForItem(folder, function(movies){
		var hasSavedTimes = self.listHasSavedTimes(movies);
		if(hasSavedTimes){
			if(!(confirm("Restart all of " + folder.title + "?"))){
				return;
			}
			self.clearTimesForList(movies);
		}
		self.queueMoviesAndPlay(movies);
	});
};

MovieDispatch.prototype.listHasSavedTimes = function(list){
	for(var i = 0, l = list.length; i < l; ++i){
		if(this.dataObject.hasSavedTime(list[i].dir)){
			return true;
		}
	}
	return false;
};

MovieDispatch.prototype.clearTimesForList = function(movies){
	for(var i = 0, l = movies.length; i < l; ++i){
		this.clearTimesForMovie(movies[i]);
	}
};

MovieDispatch.prototype.getTabElementsForMovie = function(movie){
	var folderElements = [];
	var self = this;
	var recurse = function(dir){
		var path = self.dataObject.getPath(dir);
		var parentFolder = self.dataObject.getCachedItem(path);
		if(parentFolder.tabElem){
			folderElements.unshift(parentFolder.tabElem);
			if(parentFolder.dir){
				recurse(parentFolder.dir);
			}
		}
	};
	
	recurse(movie.dir);
	return folderElements;
};

MovieDispatch.prototype.clearTimesForMovie = function(movie){
	movie.time = 0;
	movie.movieItem.done = false;
	movie.movieItem.updateOption("time", 0);
	movie.movieItem.reset();
	this.dataObject.clearTime(movie);
};

MovieDispatch.prototype.regenerateThumb = function(path, thumbTime){
	var self = this;
	
	var movie = self.player.currentMovie;
	var path = movie.dir;
	var thumbTime;
	var date = new Date(null);
    date.setMilliseconds(this.player.moviePlayer.currentTime() * 1000);
    
    var tt = date.toISOString().substr(11);
    var tt2 = tt.match(/.*\.\d*/);
    if(tt2){
    	thumbTime = tt2[0];
    }else{
    	thumbTime = date.toISOString().substr(11, 8);
    }
	
	this.dataObject.regenerateThumb(path, thumbTime, function(result){
		self.player.currentMovie.movieItem.refreshThumb();
	});
};

MovieDispatch.prototype.restartAll = function(folder, callback){
	if(!(confirm("Restart all of " + folder.title + "?"))){
		return;
	}
	var self = this;
	this.fetchDirectoryForItem(folder, function(movies){
		self.clearTimesForList(movies);
		self.player.clearCurrentMovie();
		self.queueMoviesAndPlay(movies);
		callback(movies[0]);
	});
};
