var fs = require('fs'),
    //sys = require('sys'),
    each = require('each'), // @TODO : à remplacer par une lib non dépendante de coffeescript (au secours)
    im = require('imagemagick'),
    mime = require('mime');

//function cp (from, to, callback){
//    sys.pump(fs.createReadStream(from), fs.createWriteStream(to), callback);
//};

var mkdirs = function(dirs, mode, callback){
    each(
        dirs,
        true,
        function(dir, next){ fs.mkdir(dir, mode, next); },
        callback
    );
};

var convertable_mimes = ['image/jpeg', 'image/png', 'application/pdf'];

var thumb = function(file, thumbfile, convert_options){
    thumbfile = thumbfile + '.' + convert_options.format;
    if (convertable_mimes.indexOf(mime.lookup(file)) !== -1){
        im.resize(_.extend(convert_options, {
            srcPath: file + '[0]', // [0] first page pdf conversion
            dstPath: thumbfile
        }), function(err){
            if (err) return './unknown.png';
            return thumbfile;
        });
    } else {
        return './unknown.png';
    }
};

var resource = function(file_resource, documents_dir, convert_options){
    var tmp_path = file_resource.path;
    var filename = tmp_path.split('/').pop();
    var path = '/' + filename.substr(0, 2);
    var thumbfile = '';

    mkdirs([documents_dir.thumbs + path, documents_dir.files + path], 0755, function(err){
        if (err) console.log(err); // @TODO : send error back to client

        fs.rename(tmp_path, documents_dir.files + path + '/' + filename, function(err){
            if (err) console.log(err);
            thumbfile = thumb(documents_dir.files + path + '/' + filename, documents_dir.thumbs + path + '/' + filename, convert_options);
        });

    });

    return {
        resource: {
            name: file_resource.filename,
            file: filename,
            thumb: thumbfile
        }
    };


};
exports.resource = resource;