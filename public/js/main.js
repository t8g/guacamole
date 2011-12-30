$(function($){
    /* jQuery objects */
    var $breadcrumb = $('.breadcrumb')
      , $subDirectory = $('#sub_directory ul')
      , $documents = $('#documents')
      , $tags = $('#tags')
      , $masterCheckbox = $documents.find('thead input')
      , $documentCheckboxes = $documents.find('tbody input');
      
    
    /********/
    /* Tags */
    /********/
   
    $tags.tagit({
        availableTags: ['thomas', 'laurence', 'sarah'],
        tagSource: function(search, showChoices) {
            $.get('/tags', { startwith: search.term.toLowerCase() }, function(data) {
                showChoices(data.map(function(tag) {
                    return tag.label;
                }));
            });
        },
        onTagAdded: function(e, $tag) {
            var url = $.url(location.href)
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
                    $overlayRightbar.show()
                }
                var text =  '<li>\
                                <span class="iconic plus-alt"></span>\
                                <span>{{name}}</span>\
                                <progress max=100></progress>'
                  , template = Hogan.compile(text)
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
        $overlayRightbar.hide().find('ul').empty();
        changeContent()
    });

    /*
    $uploader.on('dragover', function(e) {
        e.stopPropagation();
        e.preventDefault();
    });
    */

    /* Add sub-directories */
   
    $('[action="/tags"]').on('submit', function(e) {
        e.preventDefault();
        var $this = $(this)
          , label = $this.find('input').val();

        $.post($this.attr('action'), { label: location.pathname.replace(/\/$/, '') + '/' + label }, function() {
            changeContent();
        });
    });
    

    /*************/
    /* Documents */
    /*************/
    
    var $documentsForm = $documents.next(),
        $documentsAction = $documentsForm.find('select');
    
    // Click on the checkboxes
    $documents.on('change', $documentCheckboxes, function(e) {
        var nbCheckbox = $documentCheckboxes.length;
        
        if (nbCheckbox) {
            $documentsForm.css({ opacity: 1 });
            if ($documentCheckboxes.filter(':checked').length < nbCheckbox) {
                $masterCheckbox.prop('checked', false);
            }
        } else {
            $documentsForm.css({ opacity: 0 });
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
    
    $documentsForm.on('submit', function(e) {
        e.preventDefault();
        
        var action = $documentsAction.val()
          , url = $documentsForm.attr('action') + action
          , ids = [].map.call($documentCheckboxes.filter(':checked'), function(el, i) {
                    return el.value;
                });

        switch (action) {
            case 'download':
                
                break;
            case 'tags':
                var toAdd = toDelete = [];
                // @TODO
                $('.global_tags').show()
                break;
            case 'move':
                
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
          , tags = url.param('tags') ? url.param('tags').split(',') : [];

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
        var text =  '<li{{^url}} class="active"{{/url}}>\
                        {{#url}}<a href="{{url}}">{{/url}}\
                            {{label}}\
                        {{#url}}</a>{{/url}}\
                        <span class="divider">/</span>'
          , template = Hogan.compile(text)
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
            }).join('');

        $breadcrumb.prepend(render)

        // Show the sub-directories
        $.get('/tags', { subdirsof: path || '/' }, function(data) {
            var text =  '<li><a href="{{url}}" title="{{label}}"><i class="iconic arrow-right-alt"></i><span>{{label}}</span></a>'
              , template = Hogan.compile(text)
              , render = data.map(function(dir) {
                    return template.render({
                        url: dir.label,
                        label: dir.label.replace(path + '/', '')
                    });
                }).join('');

            $subDirectory.append(render);
        });

        var realTags = tags;
        realTags.push(path || '/');
        // Show the documents
        $.get('/documents', { tags: realTags.join(',') }, function(data) {
            var text =  '{{#title}}\
                        <tr data-tags="[{{tags}}]">\
                            <td><a href="/documents/{{id}}/file">{{title}}<img src="/documents/{{id}}/thumbnail" /></a>\
                            <td>{{created_at}}\
                            <td>{{size}} ko\
                            <td>{{mime}}\
                            <td><input type="checkbox" value="{{id}}">\
                        {{/title}}\
                        {{^title}}\
                        <tr><td>T<td>O<td>D<td>O<td>\
                        {{/title}}'
              , template = Hogan.compile(text)
              , nbDocs = data.length
              , render = nbDocs ?
                    data.map(function (doc) {
                        return template.render({
                            title: doc.title,
                            created_at: doc.created_at.split('T')[0].split('-').reverse().join('/'),
                            // Size from o to ko
                            size: Math.ceil(doc.resource.size / 1024),
                            mime: doc.resource.mime.split('/')[1],
                            id: doc._id
                        });
                    }).join('') :
                    template.render({ empty: true });

            // Uncheck the $masterCheckbox
            $masterCheckbox.prop('checked', false);
            $documentCheckboxes = $documents.find('tbody').html(render).find('input');
            
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