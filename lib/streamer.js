var fs = require("fs");

module.exports = function(req, res, filePath){
	processVideoStream(filePath, req, res);
};

function processVideoStream(file, req, res) {
	var rangeHeader = req.headers.range;
	var positions = rangeHeader.replace(/bytes=/, "").split("-");
	fs.stat(file, function(error, stat){
		if(error){
			return res.status(404).send({
				"error": "File not found"
			});
		}
		
		var info = calculateFileInfo(stat.size, positions);
		writeHeaders(res, info.start, info.end, info.total, info.chunksize);
		var responseStream = fs.createReadStream(file, {
			"flags": "r",
			"start": info.start,
			"end": info.end + 1
		});
		responseStream.pipe(res);
	});
}

function calculateFileInfo(size, positions) {
	var start = parseInt(positions[0], 10);
	var end = positions[1] ? parseInt(positions[1], 10) : size - 1;
	if(start > end){
		end = start + 1;
	}
	return {
		"total": size,
		"start": start,
		"end": end,
		"chunksize": (end - start) + 1
	};
}

function writeHeaders(res, start, end, total, chunkSize) {
	res.writeHead(206, {
		"Content-Range": "bytes " + start + "-" + end + "/" + total,
		"Accept-Ranges": "bytes",
		"Content-Length": chunkSize,
		"Connection": "keep-alive",
		"Content-Type": "video/mp4"
	});
}
