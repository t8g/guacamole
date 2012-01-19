#!/usr/bin/env node
var mysql = require('mysql')
    , database = 'docatl'
    , mongoose = require('mongoose')
    , models = require(__dirname + '/models')
    , tools = require(__dirname + '/tools')
    , fs = require('fs')
    , path = require('path')
    , _ = require('underscore')
    , nconf = require('nconf')
    , async = require('async')
    ;



/**
 * Configuration
 */
nconf.file({ file: __dirname + '/conf.json' });

/**
 * MySQL Configuration
 */
var client = mysql.createClient({
    user: 'root',
    password: '3a5yt00g'
});

client.query('USE ' + database);


/**
 * Mongo Configuration (mongoose)
 */
var Document, Tag, db;
models.define(mongoose, function() {
    Document = mongoose.model('Document');
    Tag = mongoose.model('Tag');
    db = mongoose.connect(nconf.get('mongo:connection'));
});
/*
// Phase 1. mysl ---> mongo

// documents
client.query(
    'SELECT d.id, d.title, d.slug, d.description, d.size, d.mime_type, d.file, d.public, d.ref_club FROM document d',
    function selectCb(err, mysql_documents) {
        if (err) throw err;

        async.forEach(
            mysql_documents,
            function(mysql_document) {

                client.query('SELECT t.title FROM tag t, document_tag dt WHERE dt.tag_id = t.id AND dt.document_id = ' + mysql_document.id, function(err, mysql_tags) {
                    if (err) throw err;
                    mysql_document.tags = mysql_tags.map(function(e) { return e.title; });
                });

                client.query('SELECT c.title FROM category c, document_category dc WHERE dc.category_id = c.id AND dc.document_id = ' + mysql_document.id, function(err, mysql_categories) {

                    mysql_categories.forEach(function(mysql_category) {
                        var cutid = mysql_document.id % 100;
                        var doc = new Document({
                            'title': mysql_document.title,
                            'slug': mysql_document.slug,
                            'description': mysql_document.description,
                            'resource': {
                                'name': mysql_document.title + mysql_document.file.substr(mysql_document.file.lastIndexOf('.')),
                                'size': mysql_document.size,
                                'mime': mysql_document.mime_type,
                                'tmp': ((cutid < 10) ? ('0' + cutid) : ('' + cutid)) + '/' + mysql_document.file
                            },
                            'tags': mysql_document.tags.concat('/' + mysql_category.title.replace(/\|/g, '/')),
                            'public': mysql_document.public,
                            'ref_club': mysql_document.ref_club
                        });
                        doc.save(function(err) {
                            if (err) throw(err);
                            console.log(doc.title);
                        });
                    });
                });
            },
            function(err) {
                if (err) throw err;
            }
        );

    }
);



// tags
client.query(
    'SELECT * FROM tag',
    function selectCb(err, mysql_tags) {
        if (err) throw err;
        async.forEach(
            mysql_tags,
            function(mysql_tag) {
                var tag = new Tag({'label': mysql_tag.title});
                tag.save(function(err) {
                    if (err) throw(err);
                    console.log(tag.label);
                });
            },
            function(err) {
                if (err) throw err;
            }
        )
    }
);


// Directory
client.query(
    'SELECT * FROM category',
    function selectCb(err, mysql_categories) {
        if (err) throw err;
        async.forEach(
            mysql_categories,
            function(mysql_category) {
                var tag = new Tag({'label': '/' + mysql_category.title.replace(/\|/g, '/') });
                tag.save(function(err) {
                    if (err) throw(err);
                    console.log(tag.label);
                });
            },
            function(err) {
                if (err) throw err;
            }
        )
    }
);
*/

// Phase 2.

//Parcours des documents sans thumbnail
//si fichier tmp existe, recopie
Document.find({}, function(err, docs) {
    if (err) throw err;

    async.forEachSeries(
        docs,
        function(doc, cb) {
            path.exists('/home/web/apero/documents/' + doc.resource.tmp, function(exist) {
                if (!exist) { console.log('???'); cb(); return; }

                var filename = doc.resource.tmp.split('/').pop();
                var pathfile = nconf.get('documents:dirs:files') + '/' + filename.substr(0, 2);

                path.exists(pathfile, function(exist) {
                    if (!exist) fs.mkdirSync(pathfile, 0755);
                    console.log(doc.title);
                    path.exists(pathfile + '/' + filename, function(exist) {
                        if (!exist)
                            tools.copy('/home/web/apero/documents/' + doc.resource.tmp, pathfile + '/' + filename, function(err) {
                                if (err) throw err;
                                doc.set('resource.file', '/' + filename.substr(0, 2) + '/' + filename);
                                doc.save();
                                cb();
                            });
                        else {
                            doc.set('resource.file', '/' + filename.substr(0, 2) + '/' + filename);
                            doc.save();
                            cb();
                        }
                    });
                });

            });
        },
        function(err) {
            if (err) throw err;
        }
    );
/*
    async.forEachSeries(
        docs,
        function(doc, cb) {
            var tmp = ((doc.resource.tmp.substr(0, doc.resource.tmp.lastIndexOf('.'))) + '.png').replace(/\//g, '/125x125_');

            path.exists('/home/web/apero/thumbnail/' + tmp, function(exist) {
                if (!exist) { cb(); return; }

                var filename = doc.resource.tmp.split('/').pop();
                var pathfile = nconf.get('documents:dirs:thumbs') + '/' + filename.substr(0, 2);

                path.exists(pathfile, function(exist) {
                    if (!exist) fs.mkdirSync(pathfile, 0755);
                    console.log(doc.title);
                    path.exists(pathfile + '/' + filename + '.png', function(exist) {
                        if (!exist)
                            tools.copy('/home/web/apero/thumbnail/' + tmp, pathfile + '/' + filename + '.png', function(err) {
                                if (err) throw err;
                                doc.set('resource.thumbnail', '/' + filename.substr(0, 2) + '/' + filename + '.png');
                                doc.save();
                                cb();
                            });
                        else {
                            doc.set('resource.thumbnail', '/' + filename.substr(0, 2) + '/' + filename + '.png');
                            doc.save();
                            cb();
                        }
                    });
                });

            });
        },
        function(err) {
            if (err) throw err;
        }
    );
*/
});

