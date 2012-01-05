$(function() {
    /* jQuery objects */
    var $window = $(window)
      , $breadcrumb = $('.breadcrumb')
      , $subDirectory = $('#sub_directory')
      , $tags = $('#tags')
      , $overlays = $('.overlay')
      , $documents = $('#documents')
      , $masterCheckbox = $documents.find('thead input')
      , $documentCheckboxes = $documents.find('tbody input')
      , $filters = $('#filters');

    /********/
    /* Misc */
    /********/

    // hide or show overlay, set data-open (for esc-key close action), scroll
    $.fn.overlayToggle = function(open) {
        return this.each(function() {
            $(this).attr('data-open', open);
            open ? $(this).show() : $(this).hide();
            $('html, body').animate({ scrollTop: $('#rightbar').offset().top - 50 }, 500);
        });
    };

    // close button on overlays
    $('.hide').live('click', function(e) {
        e.preventDefault();
        $(this).parents('.overlay').overlayToggle(false);
    });

    // Twipsy
    $('[data-twipsy]').twipsy();

    // Close overlays on escape
    $window.on('keydown', function(e) {
        var $openOverlay = $overlays.filter('[data-open=true]');
        if (e.keyCode === 27 && $openOverlay.length) {
            $openOverlay.overlayToggle(false);
        }
    });


$('#filters').submit(function(e) {


console.log('ici');

    e.preventDefault();
    var form = {}
        , url = $.url(location.href)
        , query = url.data.param.query;

    $.map($(this).serializeArray(), function(n, i){
        form[n['name']] = n['value'];
    });

    $.extend(query, form);

    url = url.attr('path') + '?' + $.map(query, function(v, k) { return v ? k + '=' + v : null; }).join('&');

    history.pushState({}, 'guacamole', url);
    changeContent(url, false);
});


    /********/
    /* Tags */
    /********/
// PREVOIR INTERDIR "/"
// GERER LES TAGS DE MANIERE GLOBALE (AVEC LES OPTIONS : SLASH OU PAS, ...)

    /* Tags functions */
    var tags = {
        source: function() {
            return function(search, showChoices) {
                $.get('/tags', { startwith: search.term.toLowerCase() }, function(data) {
                    showChoices(data.map(function(tag) {
                        return tag.label;
                    }));
                });
            }
        }
      , added: function() {
            return function(e, $tag) {
                var $this = $(this)
                  , tag = $this.tagit('tagLabel', $tag)
                  , pos = $this.data('todelete').indexOf(tag);

                $this.data('some').indexOf(tag) !== -1 ?
                    $tag.css({ opacity: .5 }) :
                    $this.data('toadd', $this.data('toadd').concat(tag));
                if (pos !== -1) {
                    var todelete = $this.data('todelete');
                    todelete.splice(pos, 1);
                    $this.data('todelete', todelete);
                }
            }
        }
      , removed: function() {
            return function(e, $tag) {
                var $this = $(this)
                  , tag = $this.tagit('tagLabel', $tag);

                // To add
                var pos = $this.data('toadd').indexOf(tag);
                if (pos !== -1) {
                    var toadd = $this.data('toadd');
                    toadd.splice(pos, 1);
                    $this.data('toadd', toadd);
                }

                // Some
                pos = $this.data('some').indexOf(tag);
                if (pos !== -1) {
                    var some = $this.data('some');
                    some.splice(pos, 1);
                    $this.data('some', some);
                }

                // To delete
                $this.data('todelete', $this.data('todelete').concat(tag));
            }
        }
      , clicked: function() {
            return function(e, $tag) {
                var $this = $(this)
                  , tag = $this.tagit('tagLabel', $tag)
                  , pos = $this.data('some').indexOf(tag)

                if (pos !== -1) {
                    var some = $this.data('some');
                    some.splice(pos, 1);
                    $this.data('some', some);
                    $this.data('toadd', $this.data('toadd').concat(tag));
                    $tag.css({'opacity': '1'});
                }
            }
        }
    }


    $tags.tagit({
        tagSource: tags.source(),
        onTagAdded: function(e, $tag) {
            var url = $.url(location.href) // à remplacer par http://medialize.github.com/URI.js/
              , tag = $tags.tagit('tagLabel', $tag)
              , tags = $tags.tagit('assignedTags');

            if (tags.indexOf(tag) === -1) {
                tags.push(tag);
                url.data.param.query['tags'] = tags.join(',');
                url = url.attr('path') + '?' + $.map(url.data.param.query, function(v, k) { return k + '=' + v; }).join('&');
                if ($tags.data('run')) {
                    history.pushState({}, 'guacamole', url);
                    changeContent(url);
                }
            }

        },
        onTagRemoved: function(e, $tag) {
            var url = $.url(location.href)
              , tag = $tags.tagit('tagLabel', $tag)
              , tags = $tags.tagit('assignedTags');

            tags.splice(tags.indexOf(tag), 1);
            if (!tags.length) {
                delete url.data.param.query['tags'];
            } else {
                url.data.param.query['tags'] = tags.join(',');
            }
            url = url.attr('path') + '?' + $.map(url.data.param.query, function(v, k) { return k + '=' + v; }).join('&');
            if ($tags.data('run')) {
                history.pushState({}, 'guacamole', url.replace(/\?$/, ''));
                changeContent(url);
            }
        },

        removeConfirmation: true
    });

    /************/
    /* Uploader */
    /************/

    // Declare Elements
    var $uploader = $('#uploader')
      , $file = $('#file')
      , $rightbar = $('#rightbar')
      , $overlayRightbar = $rightbar.find('.global_uploads');

    $file.on('click', function(e) {
        if ('webkitNotifications' in window && webkitNotifications.checkPermission() !== 0)
            webkitNotifications.requestPermission();
    });

    // @TODO verifier si l'event drop est necessaire
    $file.on('change', function(e) {
        // If it's dropped
        $uploader.removeClass('over');
        e.stopPropagation();
        e.preventDefault();

        var files = this.files;

        [].forEach.call(files, function(file, i) {
            // Ne marche pas sur IE9 et Opera http://caniuse.com/#search=formdata
            var formData = new FormData()
              , xhr = new XMLHttpRequest()
              , $progress;

            // Add the tag and the file to the form
            formData.append('tags', location.pathname)
            formData.append('resource', file)

            // Open the connection
            xhr.open('POST', '/documents');

            xhr.upload.addEventListener('loadstart', function(e) {
                // First file, show the overlay
                if (i === 0) {
                    $overlayRightbar.overlayToggle(true);
                }
                var template = Hogan.compile(templates.upload)
                  , render = template.render({ name: file.name });

                $progress = $overlayRightbar.find('ul').append(render).find('progress');
            }, false);

            xhr.upload.addEventListener('progress', function(e) {
                if (e.lengthComputable) {
                    var percentLoaded = Math.round((e.loaded / e.total) * 100);
                    if (percentLoaded <= 100) {
                        $progress.val(percentLoaded);
                    }
                }
            }, false);

            // Send the form
            xhr.send(formData);
        });
    });

    $uploader.on('dragenter dragleave', function(e) {
        $uploader.toggleClass('over', e.type === 'dragenter');
    });

    $overlayRightbar.on('click', 'button.danger', function(e) {
        $overlayRightbar.overlayToggle(false).find('ul').empty();
        changeContent()
    });

    /*
    $uploader.on('dragover', function(e) {
        e.stopPropagation();
        e.preventDefault();
    });
    */

    /*******************/
    /* Sub-directories */
    /*******************/

    $('[action="/tags"]').on('submit', function(e) {
        e.preventDefault();
        var $this = $(this)
          , label = $this.find('input').val();

        $.post($this.attr('action'), { label: location.pathname.replace(/\/$/, '') + '/' + label }, function() {
            changeContent();
            $this.find('input').val('');
        });
    });


    /*************/
    /* Documents */
    /*************/

    var $documentsForm = $documents.find('tfoot form')
      , $documentsAction = $documentsForm.find('select')
      , $globalTags = $('.global_tags')
      , $globalTagsTags = $globalTags.find('.tags')
      , $documentEdit = $('.document_edit')
      , $documentEditContent = $documentEdit.find('.content')

    // Edit document
    $documents.on('click', 'a', function(e) {
        e.preventDefault();
        $.get(this.href, function(doc) {
            $documentEdit.overlayToggle(true);

            var template = Hogan.compile(templates.editForm)
              , render = template.render({
                    title: doc.title,
                    created_at: doc.created_at.split('T')[0].split('-').reverse().join('/'),
                    // Size from o to ko
                    size: Math.ceil(doc.resource.size / 1024),
                    mime: doc.resource.mime.split('/')[1],
                    thumbnail: '/documents/' + doc._id + '/thumbnail',
                    file: '/documents/' + doc._id + '/file',
                    id: doc._id,
                    // Not those which start with a /
                    tags: doc.tags.filter(function(tag) {
                            return tag[0] !== '/';
                        }),
                    // The one which start with a /
                    repertoire: doc.tags.filter(function(tag) {
                            return tag[0] === '/';
                        })[0]
              });
            $documentEditContent.html(render);
        });
    });

    // Click on the checkboxes
    $documents.on('change', $documentCheckboxes, function(e) {
        var nbCheckbox = $documentCheckboxes.length
            , nbChecked;
        if (nbCheckbox) {
            nbChecked = $documentCheckboxes.filter(':checked').length;
            $documentsForm.css({ opacity: 1 });
            if (nbChecked == 0) $documentsForm.css({ opacity: 0 });
            if (nbChecked < nbCheckbox) $masterCheckbox.prop('checked', false);
        }
    });

    // Change the $masterCheckbox
    $masterCheckbox.on('change', function(e) {
        // If all are checkec, uncheck
        if ($documentCheckboxes.filter(':checked').length === $documentCheckboxes.length) {
            $documentCheckboxes.prop('checked', false);
            $documentsForm.css({ opacity: 0 });
        // Else, check all
        } else {
            $documentCheckboxes.prop('checked', true);
            $documentsForm.css({ opacity: 1 });
        }
    });

    // Initialize the tagits
    $globalTagsTags.tagit({
        tagSource: tags.source(),
        onTagAdded: tags.added(),
        onTagRemoved: tags.removed(),
        onTagClicked: tags.clicked()
    });

    // Save
    $('#save_global_tags').on('click', function(e) {
        e.preventDefault();
        $.post('/documents/batch/tags', {
                ids: $globalTagsTags.data('ids'),
                toadd: $globalTagsTags.data('toadd'),
                todelete: $globalTagsTags.data('todelete')
            }, function(data) {
                $globalTags.overlayToggle(false);
                changeContent();
            });
    });

    $documentsForm.on('submit', function(e) {
        e.preventDefault();

        var $documentChecked = $documentCheckboxes.filter(':checked')
          , action = $documentsAction.val()
          , url = $documentsForm.attr('action') + action
          , ids = [].map.call($documentChecked, function(el, i) {
                    return el.value;
                });

        switch (action) {
            case 'download':
                $('.global_download').show();
                $('.global_download .content').html('MESSAGE ATTENTE ... + GIF ANIME OU ... ');
                $.post(url, { ids: ids }, function(data) {
                    if (data.zipfile) {
                        $('.global_download .content').html('<a href="' + '/documents/batch/download/' + data.zipfile + '">' + data.zipfile + '</a>');
                    } else {
                        $('.global_download').hide();
                        alert('Error while creating archive file');
                    }
                });
                break;

            case 'tags':
                var allInOne = []
                  , some = [];

                // Store the tags
                $documentChecked.each(function() {
                    var doc_tags = $(this).parents('tr').data('tags');
                    allInOne.push(doc_tags);
                    some = some.concat(doc_tags);
                });

                // intersection de plusieurs tableaux
                var every = allInOne.reduce(function(m1, e1, i1) {
                    if (i1 == 0) return e1;
                    return e1.reduce(function(m2, e2) {
                        if (m1.indexOf(e2) !== -1) m2.push(e2);
                        return m2;
                    }, []);
                });

                // create dashed tags
                some = $.unique(some).filter(function(e) {
                    return every.indexOf(e) == -1;
                });

                // Store the datas
                $globalTagsTags.tagit('removeAll').data({
                    ids: ids
                  , some: some
                  , toadd: []
                  , todelete: []
                });

                // create tags
                every.concat(some).sort().forEach(function(tag) {
                    $globalTagsTags.tagit("createTag", tag);
                });

                $globalTags.overlayToggle(true);
            case 'edit':

                break;

            case 'move':
                $('.global_move').show();
                break;

            case 'delete':
                if (confirm('Êtes-vous sûr de vouloir supprimer ces documents ?')) {
                    $.post(url, { ids: ids }, function() {
                        changeContent();
                    });
                }
                break;
        }

    })


    /********/
    /* Data */
    /********/

    var changeState = function(e) {
        e.preventDefault();
        var url = e.currentTarget.pathname ? e.currentTarget.pathname + e.currentTarget.search : e.target.location.pathname + e.target.location.search;
        history.pushState({}, 'guacamole', url);
        changeContent(url, e.type === 'popstate');
    }

    $breadcrumb.on('click', 'a', changeState)
    $subDirectory.on('click', 'a', changeState)
    window.addEventListener('popstate', changeState);

    // @TODO window ?
    window.changeContent = function(url, isPopstate) {
        var url = $.url(url)
            // Remove the last /
            , path = url.attr('path').replace(/\/$/, '')
            , tags = url.param('tags') ? url.param('tags').split(',') : []
            , parameters = url.param()
            ;

        // Add tags from url
        if (isPopstate || !$tags.data('run')) {
            $tags.data('run', false).tagit('removeAll');
            tags.forEach(function(tag, i) {
                $tags.tagit("createTag", tag);
            });
            $tags.data('run', true)
        }

        // Flush the content
        $breadcrumb.find('li:not(:last-child)').remove();
        $subDirectory.find('li:not(:first-child)').remove();

        // Show the breadcrumb
        var template = Hogan.compile(templates.breadcrumb)
            , routes = path.split('/')
            , nbRoutes = routes.length
            , url = ''
            , render = path.split('/').map(function(route, i) {
                url += route + '/'
                return template.render({
                    // If i + 1 = nbRoutes, it's the current one
                    url: i + 1 === nbRoutes ? 0 : url,
                    label: route || 'Home'
                });
            }).join('')
            , infoFooter = $documents.find('tfoot td:first');

        $breadcrumb.prepend(render)

        // Show the sub-directories
        $.get('/tags', { subdirsof: path || '/' }, function(data) {
            // Affichage du '..' en premier
            if (path) data.unshift({ label: '..', url: path.substring(0, path.lastIndexOf('/')) });
            var template = Hogan.compile(templates.subDir)
              , render = data.map(function(dir) {
                    return template.render({
                        url: dir.url || dir.label,
                        label: dir.label.replace(path + '/', '')
                    });
                }).join('');
            $subDirectory.append(render);
        });

        var realTags = tags;
        realTags.push(path || '/');
        parameters.tags = realTags.join(',');
        // Show the documents
            $.get('/documents', parameters, function(data) {
            //$.get('/documents', { 'tags': realTags.join(',') }, function(data) {
            // <a href="/documents/{{id}}/file">{{title}}<img src="/documents/{{id}}/thumbnail" /></a>
            var template = Hogan.compile(templates.document)
              , nbDocs = data.length
              , render = nbDocs ?
                    data.map(function (doc) {
                        return template.render({
                            title: doc.title,
                            created_at: doc.created_at.split('T')[0].split('-').reverse().join('/'),
                            // Size from o to ko
                            size: Math.ceil(doc.resource.size / 1024),
                            mime: doc.resource.mime.split('/')[1],
                            id: doc._id,
                            // jQuery map because `return null` does not store the value
                            tags: $.map(doc.tags, function(tag) {
                                    return /^\//.test(tag) ? null : '"' + tag + '"';
                                }).join(',')
                        });
                    }).join('') :
                    template.render({ empty: true });

            // Uncheck the $masterCheckbox
            $masterCheckbox.prop('checked', false);
            $documentCheckboxes = $documents.find('tbody').html(render).find('input');

            infoFooter.html(data.length + ' documents trouvés');

            // The first time, initialize tablesorter, afterwards, update it
            if (!$documents.data('sorted')) {
                $documents.tablesorter({
                    sortList: [[1,0]],
                    headers: {
                        // Don't sort on checkboxes
                        4: {
                            sorter: false
                        }
                    }
                }).data('sorted', true);
            } else {
                $documents.trigger('update');
            }
        });
    };
});


/*************/
/* Templates */
/* Done with Hogan.js (http://twitter.github.com/hogan.js/) based on mustache (http://mustache.github.com/mustache.5.html) */
/*************/


var templates = {
    upload: '<li>\
                <span class="label warning">\
                	<span class="iconic plus-alt"></span>{{name}}\
                </span>\
                <progress max=100></progress>'
  , breadcrumb: '<li{{^url}} class="active"{{/url}}>\
                    {{#url}}<a href="{{url}}">{{/url}}\
                        {{label}}\
                    {{#url}}</a>{{/url}}\
                    <span class="divider">/</span>'
  , document: '{{#title}}\
                <tr data-tags="[{{tags}}]">\
                    <td><a href="/documents/{{id}}">{{title}}\
                    <td>{{created_at}}\
                    <td>{{size}} ko\
                    <td>{{mime}}\
                    <td><input type="checkbox" value="{{id}}">\
                {{/title}}'
  , subDir: '<li><a href="{{url}}" title="{{label}}"><i class="iconic arrow-right-alt"></i><span>{{label}}</span></a>'
  , editForm: '<form>\
                <fieldset>\
                  <label for="title">Titre : </label>\
                  <div class="input">\
                    <input class="xlarge" type="text" name="title" id="title" value={{title}}>\
                  </div>\
                </fieldset>\
                <fieldset>\
                  <label for="description">Description : </label>\
                  <div class="input">\
                    <textarea class="xlarge" name="description" id="description" rows="3">{{description}}</textarea>\
                  </div>\
                </fieldset>\
                <fieldset>\
                  <label for="type">Type : </label>\
                  <div class="input">\
                    <span class="uneditable-input">{{mime}}</span>\
                  </div>\
                </fieldset>\
                <fieldset>\
                  <label for="poids">Poids : </label>\
                  <div class="input">\
                    <span class="uneditable-input">{{size}} ko</span>\
                  </div>\
                </fieldset>\
                <fieldset>\
                  <label for="date">Date : </label>\
                  <div class="input">\
                    <span class="uneditable-input">{{created_at}}</span>\
                  </div>\
                </fieldset>\
                <fieldset>\
                  <label for="apercu">Aperçu : </label>\
                  <div class="input">\
                    <img src="{{thumbnail}}">\
                    <input class="input-file xlarge" id="fileInput" name="fileInput" type="file">\
                  </div>\
                </fieldset>\
                <fieldset>\
                  <label for="tags">Tags : </label>\
                  <div class="input"></div>\
                    {{tags}}\
                </fieldset>\
                <fieldset>\
                  <label for="repertoire">Répertoire : </label>\
                  <div class="input">\
                    <input class="xlarge" type="text" name="repertoire" id="repertoire" value={{repertoire}} />\
                  </div>\
                </fieldset>\
                <fieldset>\
                  <label for="replace">Remplacer : </label>\
                  <div class="input">\
                    <button class="btn primary left"><span class="iconic arrow-up"></span>Upload</button>\
                    <div class="optioncheckbox">\
                      <input type="checkbox" name="Checkboxes" value="option">\
                      <span>Regénérer l\'aperçu</span>\
                    </div>\
                  </div>\
                </fieldset>\
                <fieldset>\
                  <label for="download">Télécharger : </label>\
                  <div class="input">\
                    <a class="btn primary" href="{{file}}"><span class="iconic arrow-bottom"></span>Download</a>\
                  </div>\
                </fieldset>\
                <fieldset>\
                  <div class="actions">\
                    <button class="btn danger"><span class="iconic x"></span>Supprimer</button>&nbsp;<button class="btn success"><span class="iconic check"></span>Sauvegarder</button>&nbsp;<button class="btn danger hide">Annuler</button>\
                  </div>\
                </fieldset>\
              </form>'
}
