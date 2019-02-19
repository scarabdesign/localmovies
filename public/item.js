
var MovieItem = function(movie, dispatch){
	this.movie = movie;
	this.dispatch = dispatch;
	this.movieList;
	this.ui;
	this.folder;
	this.done;
	this.timeStarted;
};

MovieItem.prototype.reset = function(){
	this.movie.time = 0;
	this.timePlayed = 0;
	this.done = false;
	$(this.progressBar).addClass("hide");
};

MovieItem.prototype.getTabIndex = function(){
	return this.dispatch.getTabIndex();
};

MovieItem.prototype.queueAndPlay = function(){
	if(this.movie.mediatype == "television"){
		return this.dispatch.queueSeriesAndPlayNext(this.movie);
	}
	this.dispatch.queueMoviesAndPlay([this.movie]);
};

MovieItem.prototype.updateOption = function(key, value){
	if(key == "time"){
		this.updateProgress();
		this.setTimePlayed();
	}
};

MovieItem.prototype.getCurrentTime = function(){
	return this.movie.time;
};

MovieItem.prototype.getSavedTime = function(){
	return this.dispatch.getSavedTime(this.movie);
};

MovieItem.prototype.setTimePlayed = function(){
	if(!this.timeStarted){
		this.timeStarted = new Date().getTime();
	}
};

MovieItem.prototype.secondsSinceStart = function(){
	if(this.timeStarted){
		return (new Date().getTime() - this.timeStarted) / 1000;
	}
	return 0;
};

MovieItem.prototype.getUI = function(isRecentTab){
	this.buildProgressBar();
	this.ui = $(ce("div"))
		.addClass("play_item_container")
		.append(
			$(ce("div"))
				.addClass("play_item_shadow"),
			$(ce("div"))
				.addClass("play_item")
				.append(
					$(ce("div"))
						.addClass("play_item_thumb")
						.css({
							"background-image": this.getMovieThumbURL()
						})
						.append(
							this.buildInfoPanel(),
							this.infoLink(),
							this.blankLink(),
							this.downloadLink(),
							this.playLink(),
							this.progressBar
						)
				),
			$(ce("div"))
				.addClass("play_item_label_container")
				.attr({
					"title": this.movie.title
				})
				.append(
					$(ce("span"))
						.addClass("play_item_label")
						.append(this.getTitle(isRecentTab))
				),
			$(ce("div"))
				.addClass("play_item_reflection")
				.css({
					"background": " linear-gradient(rgb(255, 255, 255), rgba(255, 255, 255, 0.7)), " + this.getMovieThumbURL() + " 0 30px "
				})
		);
	return this.ui;
};

MovieItem.prototype.buildProgressBar = function(){
	this.progressBar = $(ce("div"))
		.addClass("progress_bar")
		.addClass(this.movie.time && this.movie.duration ? null : "hide");
	this.updateProgress();
};

MovieItem.prototype.updateProgress = function(showDone){
	var self = this;
	$(this.progressBar)
		.removeClass((this.movie.time && this.movie.duration) || showDone ? "hide" : null)
		.css({
			"background": function(){
				var percent;
				if(showDone){
					percent = 100;
				}else{
					percent = self.percentDone();
				}
				return "linear-gradient(to right, #0000ff " + percent + "%, #000000 " + percent + "%)";
			}
		});
};

MovieItem.prototype.isDone = function(){
	if(this.done){
		return true;
	}
	var perc = this.percentDone();
	if(perc > 95){
		return this.done = true;
	}
	return this.done = false;
};

// isStarted (>= 60 sec) but not isDone
MovieItem.prototype.isStarted = function(){
	if(!this.movie.time || !this.movie.duration){
		return false
	}
	if(this.movie.time >= 60){
		return true;
	}
	return false;
};

MovieItem.prototype.percentDone = function(){
	return parseInt(this.percentDonePrecise(), 10);
};

MovieItem.prototype.percentDonePrecise  = function(){
	var time = this.movie.time;
	var duration = this.movie.duration;
	if(!time || !duration){
		return 0;
	}
	return (time / (duration / 100));
};

MovieItem.prototype.scrollLeftTo = function(){
	if(this.movie.mediatype != "television"){
		return;
	}
	
	$(this.ui).parent()
		.animate({
			"scrollLeft": 291 * $(this.ui).index()
		});
};

MovieItem.prototype.getMovieThumbURL = function(ts){
	var image = this.movie.image;
	if(ts){
		image += "?ts=" + ts;
	}
	return "url('/public/movies/images/" + image + "')";
};

MovieItem.prototype.getMovieScreenUrl = function(){
	return "/movies/screen?p=" + this.movie.dir + "&t=" + (this.movie.time || "0") ;
};

MovieItem.prototype.refreshThumb = function(){
	$(".play_item_thumb", this.ui)
		.css({
			"background-image": this.getMovieThumbURL(new Date().getTime())
		});
};

MovieItem.prototype.hoverItem = function(title, leftRight, onclick){
	return $(ce("div"))
		.addClass("hide hover_item")
		.addClass(leftRight ? "hover_item_l" : "hover_item_r")
		.append(
			$(ce("div"))
				.addClass(leftRight ? "hover_item_left" : "hover_item_right")
				.append(title)
				.on("click", onclick)
		);
};

MovieItem.prototype.hoverAnchor = function(title, leftRight, href, target, download){
	var attr = {
		"href": href,
		"target": target
	};
	if(download){
		attr.download = true;
	}
	return $(ce("div"))
		.addClass("hide hover_item")
		.addClass(leftRight ? "hover_item_l" : "hover_item_r")
		.append(
			$(ce("a"))
				.addClass(leftRight ? "hover_item_left" : "hover_item_right")
				.attr(attr)
				.append(title)
		);
};

MovieItem.prototype.actionLink = function(className){
	return $(ce("div"))
		.addClass("fa fa-lg clickable")
		.addClass(className)
		.attr({
			"tabindex": this.getTabIndex()
		});
};

MovieItem.prototype.anchorLink = function(className, href, target, download){
	var attr = {
		"tabindex": this.getTabIndex(),
		"href": href,
		"target": target
	};
	if(download){
		attr.download = true;
	}
	return $(ce("a"))
		.addClass("fa fa-lg clickable")
		.addClass(className)
		.attr(attr);
};

MovieItem.prototype.actionItem = function(title, className, leftRight, hasHover, onclick){
	var link = this.actionLink(className);
	if(hasHover){
		var hoverElem = this.hoverItem(title, leftRight, onclick);
		this.linkHover(link, hoverElem, onclick);
	}else{
		$(link).on("click", onclick);
	}
	
	return link;
};

MovieItem.prototype.anchorItem = function(title, className, leftRight, hasHover, href, target, download){
	var link;
	if(isMobile()){
		link = this.actionLink(className);
	}else{
		link = this.anchorLink(className, href, target, download);
	}
	
	if(hasHover){
		var hoverElem = this.hoverAnchor(title, leftRight, href, target, download);
		this.linkHover(link, hoverElem);
	}
	
	return link;
};

MovieItem.prototype.linkHover = function(link, hoverElem, onclick){
	var self = this;
	$(link).append(hoverElem);
	var onhover = function(e){
		var hidden = $(hoverElem).hasClass("hide");
		$(".hover_item", self.ui).addClass("hide");
		if(hidden){
			$(hoverElem).removeClass("hide");
		}else{
			$(hoverElem).addClass("hide");
		}
		
	};
	if(isMobile()){
		$(link)
			.on("click", onhover);
	}else{
		$(link)
			.on("mouseover mouseout", onhover)
			.on("click", onclick);
	}
};

MovieItem.prototype.playLink = function(){
	if(this.movie.filetype != "mp4" && this.movie.filetype != "mkv"){
		return "";
	}
	
	var self = this;
	return this.actionItem(
		null, "play_link fa-play-circle fa-5x", null, false,
		function(e){
			self.queueAndPlay();
		}
	);
};

MovieItem.prototype.infoLink = function(){
	var self = this;
	return this.actionItem(
		"Info",	"movie_item_left fa-info-circle", true,	true, function(e){
			self.getInfo(
				$(e.target)
					.closest(".play_item_thumb")
					.find(".movie_info_panel")
			);
		}
	);
};

MovieItem.prototype.blankLink = function(){ 
	if(this.movie.filetype != "mp4" && this.movie.filetype != "mkv"){
		return "";
	}
	return this.anchorItem(
		"New Window", "movie_item_right fa-share", false, true, 
		this.movie.dir + "?service=movies", "_blank", false
	);
};

MovieItem.prototype.downloadLink = function(){
	return this.anchorItem(
		"Download", "movie_item_right fa-download", false, true,
		this.movie.dir + "?service=movies", "_blank", true
	);
};

MovieItem.prototype.getTitle = function(isRecentTab){
	if(isRecentTab){
		return this.fullTitle();
	}
	return (this.movie.episode ? this.movie.episode + " ": "") + this.movie.title;
};

MovieItem.prototype.getReverseFullTitle = function(isRecentTab){
	return (this.movie.episode ? this.movie.episode + " ": "") + 
		this.movie.title + 
		(this.movie.show ? " :: " + this.movie.show: "") + 
		(this.movie.season ? " " + this.movie.season: "");
};

MovieItem.prototype.fullTitle = function(){
	return (this.movie.show ? this.movie.show + ": " : "") + 
		(this.movie.season ? this.movie.season + " " : "") + 
		(this.movie.episode ? this.movie.episode + " ": "") +
		this.movie.title;
};

MovieItem.prototype.searchTitle = function(){
	var searchString = this.movie.title;
	if(this.movie.mediatype == "television"){
		if(this.movie.episode){
			searchString = this.movie.episode.replace("E", "Episode ") + " " + searchString;
		}
		if(this.movie.season){
			searchString = this.movie.season.replace("S", "Season ") + " " + searchString;
		}
		if(this.movie.show){
			searchString = this.movie.show + " " + searchString;
		}
	}
	return searchString;
};

MovieItem.prototype.buildInfoPanel = function(){
	var searchString = this.searchTitle();
	return $(ce("div"))
		.addClass("movie_info_panel hide")
		.append(
			$(ce("div"))
				.addClass("details_button details_closer clickable fa fa-times")
				.on("click", this.openInfoPanel),
			$(ce("a"))
				.addClass("details_button clickable fa fa-wikipedia-w")
				.attr({
					"href": "http://google.com/search?q=" + searchString + "+site%3Aen.wikipedia.org&btnI=I",
					"target": "_blank"
				}),
			$(ce("a"))
				.addClass("details_button clickable fa fa-google")
					.attr({
						"href": "http://google.com/search?q=" + searchString,
						"target": "_blank"
					}),
			$(ce("div"))
				.addClass("details_container")
		);
};

MovieItem.prototype.openInfoPanel = function(e){
	var target = $(e.target).closest(".movie_info_panel");
	$(target)
		.animate({
			"width": 0,
			"height": 0
		}, function(){
			$(target)
				.addClass("hide")
		});
};

MovieItem.prototype.showSpinner = function(target){
	$(".details_container", target)
		.empty()
		.append(
			$(ce("div"))
				.addClass("info_spinner spinner fa fa-3x fa-spinner fa-spin")
		);
};

MovieItem.prototype.hideSpinner = function(target){
	$(".info_spinner", target).remove();
};

MovieItem.prototype.openDetails = function(target){
	$(target)
		.css({
			"width": 0,
			"height": 0
		})
		.removeClass("hide")
		.animate({
			"width": "93%",
			"height": "88%"
		});
};

MovieItem.prototype.addItemToInfoPanel = function(key, target){
	var val = this.movie.details[key];
	if(key == "Create Date"){
		var dateval = new Date(val.replace(/:/, '/').replace(/:/, '/'));
		val = dateval.getFullYear() + "/" + dateval.getMonth() + "/" + dateval.getDate();
	}
	$(".details_container", target)
		.append(
			$(ce("label")).append(key, " : ", val)
		);
};

MovieItem.prototype.getInfo = function(target){

	this.showSpinner(target);
	this.openDetails(target);
	
	var detailItem = [
    	"Duration", "File Size", "Create Date", 
    	"Video Frame Rate", "Audio Channels", 
    	"Audio Sample Rate", "Image Width", "Image Height"
    ];
	
	var self = this;
	this.dispatch.getMovieDetails(this.movie, function(){
		self.hideSpinner(target);
		for(var i = 0, l = detailItem.length; i < l; ++i){
			self.addItemToInfoPanel(detailItem[i], target);
		}
	});
};
