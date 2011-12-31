var fs = require('fs')
    , path = require('path')
    , http = require('http')
    ;

/**
 * Monkey-patch adding "res.respond(...)"
 * Usages:
 *  - res.respond(content as string or object) → 200 OK, with JSON encoded content
 *  - res.respond(status as number) → given status, with undefined content
 *  - res.respond(content, status) → ok, you got it :)
 */
http.ServerResponse.prototype.respond = function (content, status) {
    if ('undefined' == typeof status) { // only one parameter found
        if ('number' == typeof content || !isNaN(parseInt(content))) { // usage "respond(status)"
            status = parseInt(content);
            content = undefined;
        } else { // usage "respond(content)"
            status = 200;
        }
    }
    if (status != 200) { // error
        content = {
            "code":        status,
            "status":    http.STATUS_CODES[status],
            "message": content && content.toString() || null
        };
    }
    if ('object' != typeof content) { // wrap content if necessary
        content = {"result":content};
    }
    // respond with JSON data
    this.send(content, status);
};

function readDir(start, callback) {
    // Use lstat to resolve symlink if we are passed a symlink
    fs.lstat(start, function(err, stat) {
        if(err) {
            return callback(err);
        }
        var found = [],
            total = 0,
            processed = 0;
        function isDir(abspath) {
            fs.stat(abspath, function(err, stat) {
                if(stat.isDirectory()) {
                    found.push(abspath);
                    // If we found a directory, recurse!
                    readDir(abspath, function(err, data) {
                        found = found.concat(data);
                        if(++processed == total) {
                            callback(null, found);
                        }
                    });
                } else {
                    found.push(abspath);
                    if(++processed == total) {
                        callback(null, found);
                    }
                }
            });
        }
        // Read through all the files in this directory
        if(stat.isDirectory()) {
            fs.readdir(start, function (err, files) {
                total = files.length;
                for(var x=0, l=files.length; x<l; x++) {
                    isDir(path.join(start, files[x]));
                }
            });
        } else {
            return callback(new Error("path: " + start + " is not a directory"));
        }
    });
};

// en faire un vrai middleware ???
function serve(file, headers, req, res, next) {
    // file, next, header, res
    fs.stat(file, function(err, stat) {

        // ignore ENOENT
        if (err) {
          return 'ENOENT' == err.code
            ? res.respond('File Not Found', 404)
            : next(err);
        } else if (stat.isDirectory()) {
          return next();
        }

        headers.forEach(function(header) {
            res.setHeader(header.name, header.value || null);
        });

        res.setHeader('Content-Length', stat.size);

        // stream
        var stream = fs.createReadStream(file);
        req.emit('static', stream);
        stream.pipe(res);

    });
}

exports.readDir = readDir;
exports.serve = serve;