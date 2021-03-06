$(function() {
    /* jQuery objects */
    var $window = $(window)
      , $modal = $('.modal')
      , $dropdown = $('.dropdown-menu')
      , $breadcrumb = $('.breadcrumb')
      , $subDirectory = $('#sub_directory')
      , $tags = $('#tags')
      , $overlays = $('.overlay')
      , $openOverlay = []
      , $documents = $('#documents')
      , $masterCheckbox = $documents.find('thead input')
      , $documentCheckboxes = $documents.find('tbody input')
      , $filterToggle = $('#filter_toggle')
      , $filters = $('#filters')
      , $filterMime = $('#filter_mime')
      , $searchForms = $('.search_form')
      , $searchInfos = $('#search_informations')
      , $navigationInfos = $('#navigation_docs')
      ;

    /********/
    /* Misc */
    /********/
   
    // Overlay
    window.$openOverlay = []
    // hide or show overlay, set data-open (for esc-key close action), scroll
    $.fn.overlayToggle = function(open) {
        window.scrollTo(0, $filterToggle.offset().top - 50);
        var $this = $(this);
        $openOverlay = open ? $this : [];
        return $this.attr('data-open', open)[open ? 'show' : 'hide']();
    };

    // close button on overlays
    $('.btn.hide').on('click', function(e) {
        e.preventDefault();
        $openOverlay.overlayToggle(false);
    });

    // Close overlays on escape
    $window.on('keydown', function(e) {
        if ($openOverlay.length && e.keyCode === 27) {
            $openOverlay.overlayToggle(false);
        }
    });

    // Close overlay on click anywhere
    $(document).on('mouseup', function(e) {
        var $this = $(e.target);
        // Has $openOverlay and target isn't in it
        if ($openOverlay.length && !$this.hasClass('overlay') && !$this.parents('.overlay').length) {
            $openOverlay.overlayToggle(false);
        }
    });

    // Twipsy
    $('[data-twipsy]').twipsy();

    // Modal
    $modal.modal({
        backdrop: true
    });

    /**************/
    /* Connection */
    /**************/

    // Get the user
    getUser = function(user) {
            var user = user || null;
            if (!user) {
                $.ajax({
                    async: false
                  , url: '/getUser'
                  , success: function(res) {
                        user = res;
                    }
                });
            }
            
            if (user) {
                $('.notLogged').removeClass('notLogged');
                $('.dropdown-login b').text(user.name);
            }
            return user;
        }
      , user = getUser();
    
    $dropdown.find('form')
    // Prevent the click on the form to close the dropdown
    .on('click', function(e) {
        e.stopPropagation();
    }).on('submit', function(e) {
        e.preventDefault();
        var form = this
          , $form = $(form);

        $.post(form.action, $form.serialize(), function(res) {
            // Error
            $form.find('input').removeClass('error');
            if (res.hasError) {
                $form.find('[name="' + res.field + '"]').addClass('error');
                alert(res.message)
            } else {
                user = getUser(res);

                var template = Hogan.compile(templates.welcome)
                  , render = template.render({ name: user.name });
                console.log(render)
                
                var template = Hogan.compile(templates.modalConnexion)
                  , render = template.render({ name: user.name });
                $modal.html(render).modal('show');
            }
        })
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
        removeConfirmation: true,
        allowSpaces: true
    }).find('input:visible').unbind('blur');

    /************/
    /* Uploader */
    /************/

    // Declare Elements
    var $uploader = $('#uploader')
      , $file = $('#file')
      , $rightbar = $('#rightbar')
      , $overlayRightbar = $rightbar.find('.global_uploads')
      , $editTags = $('.edit_tags');

    $file.on('click', function(e) {
        if ('webkitNotifications' in window && webkitNotifications.checkPermission() !== 0)
            webkitNotifications.requestPermission();
    });

    // @TODO verifier si l'event drop est necessaire
    // @FIXME check espae dans répertoires
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

            // Add the tag and the file to the form, let spaces in it
            formData.append('tags', location.pathname.replace(/%20/g, ' '))
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

            // Store the ids
            var ids = [];
            xhr.addEventListener('readystatechange', function(e) {
                if (this.readyState === 4 && this.status === 200) {
                    var response = JSON.parse(xhr.response);
                    ids.push(response._id);
                    if (ids.length === files.length) {
                        // Flush the result and update the table
                        $file.val('');
                        changeContent();
                    }
                }
            }, false);

            // Send the form
            xhr.send(formData);

            // Create the tags
            $editTags.on('click', function(e) {
                e.preventDefault();

                $globalTagsTags.tagit('removeAll').data({
                    ids: ids
                  , some: []
                  , toadd: []
                  , todelete: []
                });

                $overlayRightbar.overlayToggle(false)
                $globalTags.overlayToggle(true);
            });
        });
    });

    $uploader.on('dragenter dragleave', function(e) {
        $uploader.toggleClass('over', e.type === 'dragenter');
    });

    $overlayRightbar.on('click', 'button.danger', function(e) {
        $overlayRightbar.overlayToggle(false).find('ul').empty();
        changeContent();
    });

    /*
    $uploader.on('dragover', function(e) {
        e.stopPropagation();
        e.preventDefault();
    });
    */

    /************/
    /* Filters */
    /************/

    $filters.on('submit', function(e) {
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
        changeContent();
    });

    // Toggle the filters
    $filterToggle.on('click', function(e) {
        $filterToggle.find('.iconic').toggleClass('plus-alt minus-alt')
        $filters.toggleClass('filters_close');
    });

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
    /* Search    */
    /*************/

    $searchForms.on('submit', function(ev) {
        ev.preventDefault();
        var $this = $(this)
            , query = $this.find('input:text').val()
            , url = query ? '/?search=' + query : '/';
        history.pushState({}, 'guacamole', url);
        changeContent();
    });

    $searchInfos.find('button.danger').on('click', function(ev) {
        ev.preventDefault();
        history.pushState({}, 'guacamole', '/');
        changeContent();
    });

    /*************/
    /* Documents */
    /*************/

    var $documentsForm = $documents.find('tfoot form')
      , $documentsAction = $documentsForm.find('select')
      , $globalTags = $('.global_tags')
      , $globalTagsTags = $globalTags.find('.tags')
      , $globalMove = $('.global_move')
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
                    description: doc.description || '',
                    created_at: doc.created_at.split('T')[0].split('-').reverse().join('/'),
                    // Size from o to ko
                    size: Math.ceil(doc.resource.size / 1024),
                    mime: doc.resource.mime.split('/')[1],
                    // @TODO image par défaut si pas de thumbnail
                    thumbnail: '/documents/' + doc._id + '/thumbnail',
                    file: '/documents/' + doc._id + '/file',
                    id: doc._id,
                    // The one which start with a /
                    repertoire: doc.tags.filter(function(tag) {
                        return tag[0] === '/';
                    })[0],
                    extra: doc.extra || ''
              });
            $documentEditContent.html(render);
            
            // Twipsy
            $documentEditContent.find('[data-twipsy]').twipsy();

            // Tagit
            var $editTag = $documentEditContent.find('.edit-tags')
              , $inputDir = $('<input>')
              , dir;

            $editTag.tagit({
                tagSource: tags.source(),
                itemName: 'tags',
                fieldName: '',
                allowSpaces: true,
                inputClasses: 'xlarge'
            });

            // Default tags
            doc.tags.forEach(function(tag) {
                // Create the tag
                if (tag.charAt(0) !== '/') {
                    $editTag.tagit('createTag', tag);
                // Add the directory
                } else {
                    $inputDir.attr({
                        type: 'hidden',
                        name: 'tags[][]',
                        value: tag
                    }).insertAfter($editTag);
                    dir = tag;
                }
            });

            // dir selector
            $documentEditContent.find('ul.dir_select').dirSelector({
                dir: dir,
                input: $inputDir
            });


            // Edit the document
            $documentEditContent.find('.edit_form').on('submit', function(e) {
                e.preventDefault();
                var data = $(this).serializeArray();
                data.push({ '_method': 'PUT' });
                $.post(this.action, data, function(data) {
                    $documentEdit.overlayToggle(false);
                    changeContent();
                });
            });

            // Delete the document
            $documentEditContent.find('.delete').on('click', function(e) {
                e.preventDefault();
                if (confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
                    $.post('/documents/' + doc._id, { '_method': 'DELETE' }, function(data) {
                        $documentEdit.overlayToggle(false);
                        changeContent();
                    });
                }
            });

            // uploader
            var $uploadonefile = $('#uploadone > input')
              , $newPreview = $('[name="new_preview"]');

            $uploadonefile.on('change', function(e) {
                if (!this.files.length) return;
                var file = this.files[0];

                // Ne marche pas sur IE9 et Opera http://caniuse.com/#search=formdata
                var formData = new FormData()
                    , xhr = new XMLHttpRequest()
                    , $progress;

                formData.append('resource', file);
                formData.append('_method', 'PUT');
                $newPreview.prop('checked') && formData.append('new_preview', true);
                

                // Open the connection
                xhr.open('POST', '/documents/' + doc._id);

                xhr.upload.addEventListener('loadstart', function(e) {
                    // affiche la progressbar
                }, false);

                xhr.upload.addEventListener('progress', function(e) {
                    if (e.lengthComputable) {
                        var percentLoaded = Math.round((e.loaded / e.total) * 100);
                        if (percentLoaded <= 100) {
                            //$progress.val(percentLoaded);
                            //update la progressbar
                        }
                    }
                }, false);

                xhr.addEventListener('readystatechange', function(e) {
                    if (this.readyState === 4 && this.status === 200) {
                        var response = JSON.parse(xhr.response);
                        ids.push(response._id);
                        if (ids.length === files.length) {
                            // Flush the result and update the table
                            $file.val('');
                            changeContent();
                        }
                    }
                }, false);

                // Send the form
                xhr.send(formData);

                console.log(files);
            });
    
            // Change preview
            var $previewForm = $('#preview_form');
            $previewForm
            .on('click', 'img', function(e) {
                $previewForm.find('input').show();
            }).on('change', 'input', function(e) {
                var input = this
                  , file = input.files[0]
                
                // Mise à jour du thumbnail seulement pour les images
                if (/^image\//.test(file.type)) {
                    var reader = new FileReader();

                    reader.onload = function(e) {
                        // Remplacer le src de l'image par le data-uri
                        input.previousElementSibling.src = this.result;
                        sendThumbnail(file, $previewForm.attr('action'));
                    };
            
                    reader.readAsDataURL(file);
                // Pour le PDF on attend la fin de la requête AJAX
                } else if (/\/pdf$/.test(file.type)) {
                    var xhr = sendThumbnail(file, $previewForm.attr('action'));

                    xhr.addEventListener('readystatechange', function(e) {
                        if (this.status === 200 && this.readyState === 4) {
                            var response = JSON.parse(this.response);
                            // Force l'affichage du nouveau thumbnail
                            input.previousElementSibling.src = '/documents/' + response._id + '/thumbnail';
                        }
                    });
                } else {
                    alert('Ce n\'est pas un fichier image !');
                }
            });
        });
    });
    
    // Requête d'envoie du nouveau thumbnail
    var sendThumbnail = function(file, action) {
        var formData = new FormData()
          , xhr = new XMLHttpRequest();

        formData.append('resource', file);
        formData.append('_method', 'PUT');
        
        xhr.open('POST', action);
        xhr.send(formData);
        return xhr;
    }

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

    // Click on the line => click on the checkbox
    $documents.on('click', 'tbody > tr', function(e) {
        if (e.target.nodeName !== 'INPUT' && e.target.nodeName !== 'A') {
            $(this).find('input')[0].click()
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
        onTagClicked: tags.clicked(),
        allowSpaces: true
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
                var pathname = location.pathname.split('/');
                $globalMove.overlayToggle(true)
                    .find('.dir_select').dirSelector({
                        dir: pathname[pathname.length - 1],
                        input: $('[name=global_move_input]')
                    });
                $('#save_global_move').off('click').on('click', function(e) {
                    e.preventDefault();
                    $.post(url, { ids: ids, path: $('[name=global_move_input]').val() }, function() {
                        changeContent();
                    });
                });
                break;

            case 'delete':
                if (confirm('Êtes-vous sûr de vouloir supprimer ces documents ?')) {
                    $.post(url, { ids: ids }, function() {
                        changeContent();
                    });
                }
                break;
        }

    });


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
          , parameters = url.param();

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
        if (!parameters.search) realTags.push(path || '/');
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
            // Render the documents
            $documentCheckboxes = $documents.find('tbody').html(render).find('input');
            // Hide the form
            $documentsForm.css({ opacity: 0 });
            infoFooter.html(data.length + ' documents trouvés');

            // Get the mime type filters
            var types = []
              , definedTypes = {}
              , template = Hogan.compile(templates.filterType)
            data.map(function (doc) {
                // If the mime type is not defined
                if (!definedTypes[doc.resource.mime]) {
                    definedTypes[doc.resource.mime] = true;
                    types.push({
                        mime: doc.resource.mime,
                        label: doc.resource.mime.split('/')[1]
                    });
                }
            });
            $filterMime.html(template.render({ types: types }));

            // Get the defaults filters
            // parameters is the filters + tags
            delete parameters.tags;
            var filters = Object.keys(parameters);
            // If it contains filters
            if (filters.length || parameters.search) {
                // If the form is closed, open it
                $filters.hasClass('filters_close') && $filterToggle.click();
                // Add the values to the fields
                filters.forEach(function(filter) {
                    $filters.find('[name="' + filter + '"]').val(parameters[filter]);
                });
            }

            if (!parameters.search) {
                if ($subDirectory.is(':hidden')) {
                    $subDirectory.show().prev('h3').show();
                }
                $searchInfos.hide();
                $navigationInfos.show();
            } else {
                $subDirectory.hide().prev('h3').hide();
                $searchInfos.show().find('input:text').val(parameters.search);
                $navigationInfos.hide();
            }

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


    /*************/
    /* Templates */
    /* Done with Hogan.js (http://twitter.github.com/hogan.js/) based on mustache (http://mustache.github.com/mustache.5.html) */
    /*************/
    
    var templates = {
        modalConnexion: false
      , upload: false
      , breadcrumb: false
      , document: false
      , subDir: '<li><a href="{{url}}" title="{{label}}"><i class="iconic arrow-right-alt"></i><span>{{label}}</span></a>'
      , filterType: false
      , editForm: false
    }

    // Get the partial if needed
    Object.keys(templates).forEach(function(key) {
        if (!templates[key]) {
          $.get('/partials/' + key + '.html', function(data) {
            templates[key] = data;
          })
        }
    });
});