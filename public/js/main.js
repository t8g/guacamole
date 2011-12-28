$(function($){
    /* Twipsy */
    $("[rel=twipsy]").twipsy({
        live: true
    })

    /* Tagit */    
    var sampleTags = ['c++', 'java', 'php', 'coldfusion', 'javascript', 'asp', 'ruby', 'python', 'c', 'scala', 'groovy', 'haskell', 'perl', 'erlang', 'apl', 'cobol', 'go', 'lua'];

    // Remove confirmation
    $('#removeConfirmationTags').tagit({
        availableTags: sampleTags,
        removeConfirmation: true
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

    $('.pull-left').on('submit', function(e) {
        e.preventDefault();
        var $this = $(this)
          , label = $this.find('input').val();
        
        $.post($this.attr('action'), { label: location.pathname.replace(/\/$/, '') + '/' + label }, function() {
            changeContent();
        });
    })
    
});    