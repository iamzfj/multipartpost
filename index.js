var http = require('http');
var URL = require('url');
var querystring = require('querystring');
var mime = require('mime');
var fs = require('fs');
var path = require('path');
var post = function(url,params,files,cb,agent,cookie){
	
	var p = URL.parse(url);
	var options = {};
	options.method = 'POST';
	options.host = p.hostname;
	options.port = p.port;
	options.path = p.path;
	if(agent){
		options.agent = agent;
	}
	
	var req = http.request(options, function(res) {
	  var data = null;
	  res.on('data', function (chunk) {
		if(!data){
			data = chunk;
		} else {
			var buf = new Buffer(data.length + chunk.length);
			data.copy(buf);
			chunk.copy(buf,data.length);
			data = buf;
		}
	  });
	  res.on('end',function (){
		cb({data:data,headers:res.headers});
	  });
	});
	req.on('error', function(e) {
		cb({err:e});
	});

	
	var boundaryKey = Math.random().toString(16);
	var lastboundary = '--' + boundaryKey + '--\r\n';
	
	var fieldLength = 0;
	var fieldsArray = [];
	for(var name in params){
		var payload = '--' + boundaryKey + '\r\n'
		+ 'Content-Disposition: form-data; name="'+name+'"\r\n\r\n'
		+ params[name];
		payload = new Buffer(payload,'ascii');
		fieldLength +=  payload.length;
		fieldsArray.push({
			payload : payload
		});
	}
	
	
	var filesPreLength = 0;
	var filesArray = [];
	for(var file in files){
		var filepath = files[file];
		var filename = path.basename(filepath);
		var prepayload = '--' + boundaryKey + '\r\n'
		+ 'Content-Type: '+ mime.lookup(filepath) +'\r\n' 
		+ 'Content-Disposition: form-data; name="'+file+'"; filename="'+filename+'"\r\n'
		+ 'Content-Transfer-Encoding: binary\r\n\r\n';
		prepayload = new Buffer(prepayload,'ascii');
		filesPreLength +=  prepayload.length;
		filesArray.push({
			filepath : filepath,
			prepayload : prepayload
		});
	}
	var filesLength = 0;
	var statCount = 0;
	for(var i = 0 ; i < filesArray.length ; i ++ ){
		fs.stat(filesArray[i].filepath,function(err,stat){
			if(err){
				throw err;
			}
			statCount ++ ;
			filesLength += stat.size;
			if(statCount == filesArray.length){
				whenLengthOk(fieldLength + filesLength + filesPreLength + 2*(fieldsArray.length + filesArray.length) + lastboundary.length);
			}
		})
	}

	var whenLengthOk = function(Length){
		if(cookie){
			console.log(cookie);
			req.setHeader('Cookie',cookie);
		}
		req.setHeader('Content-Type', 'multipart/form-data; boundary='+boundaryKey);
		req.setHeader('Content-Length', Length);
		
		for(var i = 0 ; i < fieldsArray.length ; i ++ ){
			req.write(fieldsArray[i].payload);
			req.write('\r\n');
		}
		
		var doOneFile = function(){
			req.write(filesArray[fileindex].prepayload);
			var fileStream = fs.createReadStream(filesArray[fileindex].filepath, { bufferSize: 4 * 1024 });
			fileStream.pipe(req, {end: false});
			fileStream.on('end', function() {
				req.write('\r\n');
				fileindex ++;
				if(fileindex == filesArray.length){
					req.end(lastboundary);
				} else {
					doOneFile();
				}			
			});
		};
		
		var fileindex = 0;
		if(fileindex == filesArray.length){
			req.end(lastboundary);
		} else {
			doOneFile();
		}		
	};
	
	if(filesArray.length == 0){
		whenLengthOk(fieldLength + filesLength + filesPreLength + 2*(fieldsArray.length + filesArray.length) + lastboundary.length);
	}
}
exports.post = post;
/*
post('http://localhost:3000',{a:1},{image:'image.jpg',req:'req.js'},function(err,data){
	console.log('' + data);
});
*/