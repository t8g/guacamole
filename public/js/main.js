$(function($){
    /* jQuery objects */
    var $tags = $('#tags')
     , $documents = $('#documents');
    
    /* Twipsy */
    $("[rel=twipsy]").twipsy({
        live: true
    })

    /* Tagit */
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
                url = url.attr('path') + '?' + $.map(url.data.param.query, function(v,k) { return k + '=' + v; }).join('&');
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
            url = url.attr('path') + '?' + $.map(url.data.param.query, function(v,k) { return k + '=' + v; }).join('&');
            if ($tags.data('run')) {
                history.pushState({}, 'guacamole', url.replace(/\?$/, ''));
                changeContent(url);
            }
        },

        removeConfirmation: true // Remove confirmation
    });

    /* Uploader */
    // Declare Elements
    var $uploader = $('#uploader')
      , $file = $('#file')
      , $rightbar = $('#rightbar')
      , $overlayRightbar = $('.overlay', $rightbar);

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

    $overlayRightbar.on('click', 'button.danger', function(e) {
        $overlayRightbar.hide();
        changeContent()
    })

    $uploader.on('dragenter dragleave', function(e) {
        $uploader.toggleClass('over', e.type === 'dragenter');
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
   
    $documents.on('change', 'thead input', function(e) {
        var $checkboxes = $documents.find('tbody input');
        // If all are checkec, uncheck
        if ($checkboxes.filter(':checked').length === $checkboxes.length) {
            
        // Else, check all
        } else {
            
        }
    });

});