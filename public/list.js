

//TODO 
// organize recent
// zoom to playing item (only from rec tab)
// if start on movie with time, prompt to continue or restart
// better system of discovering new stuff
// make the MovieType object the primary type
//		all props have an interface
//		created in data controller
//		returns savable items
// swap variable names "dir" "path" globally
// test iframe player
// use listeners to determine logout
//		saves remote before logging out
// movie panel should be big as screen
//		movie lists would be side slideout overlay

var MovieList = function(username, service, datacache){
	this.spinner;
	var self = this;
	this.dispatch = new MovieDispatch(datacache);
	this.dispatch.init(username, service, function(root){
		self.dispatch.setListeners(
			["timeupdate", "loadeddata"], self, self.setFolderOption
		);
		self.init(root);
		self.imageRegen(username);
	});
};

MovieList.prototype.imageRegen = function(username){
	if(username != "sean"){
		return;
	}
	var self = this;
	$("body")
		.append(
			$(ce("div"))
				.addClass("regen_image clickable")
				.append("RE")
				.on("click", function(){
					self.dispatch.regenerateThumb();
				})
		);
};

MovieList.prototype.setFolderOption = function(movie){
	if(movie){
		var folderItem = this.dispatch.dataObject.getCachedItem(movie.path);
		this.updateGroupPlayOptions(true, folderItem, movie);
	}
};

MovieList.prototype.init = function(root){
	this.getDirectory({
		"dir": root,
		"subFolder": $(".media_list")
	});
};

MovieList.prototype.getDirectory = function(folder){
	var self = this;
	this.showSpinner(true, folder.subFolder);
	this.dispatch.fetchDirectory(folder.dir, function(movies){
		self.buildDirectory(movies || [], folder);
		self.adjustTop();
		self.showSpinner(false, folder.subFolder);
	});
};

MovieList.prototype.saveRemoteSettings = function(){
	this.dispatch && this.dispatch.saveRemoteSettings();
};

MovieList.prototype.showSpinner = function(onOff, subFolder){
	if(!this.spinner){
		this.spinner = $(ce("div"))
			.addClass("spinner fa fa-3x fa-spinner fa-spin");
	}
	if(onOff){
		return $(subFolder)
			.append(this.spinner);
	}
	$(this.spinner).remove();
};

MovieList.prototype.adjustTop = function(){
	var height = 20; 
	$(".curtains").each(
		function(i, elem){
			height += $(elem).height()
		}
	);
	
	$(".media_list > .folder")
		.css({
			"top": height
		});
};

MovieList.prototype.buildDirectory = function(items, folder){
	
	var folderElem = folder.subFolder;
	var thumbslider, tabs, subFolders;
	var numMP4s = 0;
	var lastStarted = 0;
	
	for(var i = 0, l = items.length; i < l; ++i){
		var item = items[i];
		if(item.type == "folder"){
			item.subFolder = $(ce("div"))
				.addClass("folder")
				.addClass(!this.dispatch.isRecentTab(item.dir) ? "hide" : null);

			item.tab = item.tab || !folder.tab;
			item.tabElem = this.buildFolder(item);
			if(item.tab){
				if(!tabs){
					tabs = [];
				}
				tabs.push($(item.tabElem).get(0));
				if(!subFolders){
					subFolders = [];
				}
				subFolders.push($(item.subFolder).get(0));
				continue;
			}
			$(folderElem).append(
				item.tabElem,
				item.subFolder
			)
		}else if(item.type == "movie"){
			if(item.movieItem.isStarted()){
				lastStarted = i;
			}
			if(item.filetype == "mp4" || item.filetype == "mkv"){
				++numMP4s;
			}
			if(item.mediatype == "television" && !this.dispatch.isRecentTab(folder.dir)){
				if(!thumbslider){
					thumbslider = $(ce("div"))
						.addClass("thumbslider")
						.on("mousewheel", function(e){
							e.preventDefault();
							if(e.originalEvent.wheelDelta / 120 > 0) {
								$(this).scrollLeft($(this).scrollLeft() - 100);
							}
							else{
								$(this).scrollLeft($(this).scrollLeft() + 100);
							}
						});
				}
				$(thumbslider).append(
					item.movieItem.getUI(this.dispatch.isRecentTab(folder.dir))
				);
			}else{
				$(folderElem).append(
					item.movieItem.getUI(this.dispatch.isRecentTab(folder.dir))
				);
			}
		}
	}
	if(tabs){
		$(folderElem).append(
			tabs, subFolders
		);
	}
	if(thumbslider){
		folderElem.append(
			$(ce("div"))
				.addClass("slide_group")
				.append(
					this.playGroupLink(folder, numMP4s) || "",
					thumbslider
				)
		);
		if(lastStarted){
			$(thumbslider)
				.scrollLeft((lastStarted)* 291);
		}
	}
};

MovieList.prototype.buildFolder = function(folder){
	var self = this;
	if(this.dispatch.isRecentTab(folder.dir)){
		this.getDirectory(folder);
	}
	var folderElem = $(ce("label"))
		.attr({"tabindex": this.dispatch.getTabIndex()})
		.addClass("clickable")
		.addClass(this.dispatch.isRecentTab(folder.dir) ? "open" : null)
		.addClass(folder.tab ? "subtab" : "movie_folder")
		.append(folder.title)		
		.on("click", function(e){
			$(this).data().activate();
		});
	
	return $(folderElem)
		.data({
			"activate": function(){
				if(folder.tab){
					return self.switchTab(folderElem, folder);
				}
				self.openFolder(folderElem, folder);
			}
		});
};

MovieList.prototype.openFolder = function(target, folder){
	var subFolderElem = folder.subFolder;
	if(!$(subFolderElem).hasClass("hide")){
		$(target).removeClass("open");
		$(subFolderElem).addClass("hide");
		$("label", subFolderElem).removeClass("open");
		return $(".folder", subFolderElem).addClass("hide");
	}
	$(target).addClass("open");
	$(subFolderElem).removeClass("hide")
	if(!$(subFolderElem).children().length){
		this.getDirectory(folder);
	}
};

MovieList.prototype.switchTab = function(target, folder){
	if($(target).hasClass("open")){
		return;
	}
	$(".folder", $(target).parent())
		.addClass("hide");
	$("label", $(target).parent())
		.removeClass("open");
	$(target).addClass("open");
	$(folder.subFolder).removeClass("hide")
	if(!$(folder.subFolder).children().length){
		this.getDirectory(folder);
	}
};

MovieList.prototype.playGroupLink = function(folder, numMP4s){
	if(!(numMP4s > 1) || this.dispatch.isRecentTab(folder.dir)){
		return null;
	}
	var link =  $(ce("div"))
		.addClass("movie_group_play_options_container")
		.append(
			$(ce("div"))
				.addClass("movie_group_play_options")
				.append(
					this.continueAllItems(folder),
					this.restartAllItems(folder),
					this.playAllItems(folder)
				)
		);
	
	var self = this;
	this.dispatch.fetchDirectoryForItem(folder, function(movies){
		self.updateGroupPlayOptions(false, folder);
		if(self.dispatch.listHasSavedTimes(movies)){
			var index = self.dispatch.getStartedIndexFromList(movies);
			self.updateGroupPlayOptions(true, folder, movies[index]);
		}
		
	});
	return link;
};

MovieList.prototype.groupPlayElem = function(folder, title, callback){
	return $(ce("div"))
		.addClass("clickable group_play_option hide")
		.attr({
			"title": title + " " + folder.title,
			"tabindex": this.dispatch.getTabIndex()
		})
		.append(
			$(ce("div"))
				.addClass("fa fa-play-circle fa-lg"),
			$(ce("span"))
				.append(
					title,
					"<br>",
					folder.title,
					"<br>",
					$(ce("b"))
						.addClass("last_played_title")
				)
		)
		.on("click", {"folder": folder}, callback)
		.on("mouseover mousedown", function(){
			$(this).css({
				"font-weight": "bold"
			})
		})
		.on("mouseout mouseup", function(){
			$(this).css({
				"font-weight": "initial"
			})
		});
};

MovieList.prototype.playAllItems = function(folder){
	var self = this;
	var playAllElem = this.groupPlayElem(folder, "Play All", function(e){
		e.stopImmediatePropagation();
		e.preventDefault();
		self.dispatch.queueMoviesAndPlayAll(e.data.folder);
	});
	
	folder.playAllElem = playAllElem;
	return playAllElem;
};

MovieList.prototype.continueAllItems = function(folder){
	var self = this;
	var continueElem = this.groupPlayElem(folder, "Continue", function(e){
		e.stopImmediatePropagation();
		e.preventDefault();
		self.dispatch.queueMoviesAndContinue(e.data.folder);
	});
	folder.continueElem = continueElem;
	return continueElem;
};

MovieList.prototype.restartAllItems = function(folder){
	var self = this;
	var restartElem = this.groupPlayElem(folder, "Restart", function(e){
		e.stopImmediatePropagation();
		e.preventDefault();
		self.dispatch.restartAll(e.data.folder, function(lastPlayed){
			self.updateGroupPlayOptions(true, folder, lastPlayed);
		});
	});
	folder.restartElem = restartElem;
	return restartElem;
};

MovieList.prototype.updateGroupPlayOptions = function(onOff, folder, lastPlayed){
	if(folder){
		if(folder.playAllElem){
			$(folder.playAllElem)
				.addClass(onOff ? "hide" : null)
				.removeClass(!onOff ? "hide" : null);
		}
		if(folder.continueElem){
			$(folder.continueElem)
				.addClass(!onOff ? "hide" : null)
				.removeClass(onOff ? "hide" : null);
			
			if(lastPlayed && lastPlayed.movieItem.isStarted()){
				var lpTitle = lastPlayed && ("[" + lastPlayed.movieItem.getTitle() + "]") || "";
				var title = "Continue" + " " + folder.title + " " + lpTitle;
				$(folder.continueElem)
					.attr({
						"title": title
					});
				$(".last_played_title", folder.continueElem)
					.empty()
					.append(lpTitle);
			}
		}
		if(folder.restartElem){
			$(folder.restartElem)
				.addClass(!onOff ? "hide" : null)
				.removeClass(onOff ? "hide" : null);
		}
	}
};


