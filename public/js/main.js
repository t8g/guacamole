$(function($){

	/* List documents
	*/
	$("table#sortTable").tablesorter({ 
		sortList: [[1,0]] 
	});
	
	/* Twipsy
	*/
	$("[rel=twipsy]").twipsy({
    live: true
  })

	/* Tagit
	*/	
	var sampleTags = ['c++', 'java', 'php', 'coldfusion', 'javascript', 'asp', 'ruby', 'python', 'c', 'scala', 'groovy', 'haskell', 'perl', 'erlang', 'apl', 'cobol', 'go', 'lua'];

	// Remove confirmation
	$('#removeConfirmationTags').tagit({
		availableTags: sampleTags,
		removeConfirmation: true
	});

	/* Uploader
	*/	
	// Declare Elements
	var $uploader = $('#uploader'),
			$file = $('#file', $uploader),
			$rightbar = $('#rightbar'),
			$overlayRightbar = $('.overlay', $rightbar);
	
	$file.on('click', function(e) {
		if ('webkitNotifications' in window && webkitNotifications.checkPermission() !== 0)
			webkitNotifications.requestPermission();
	});
	
	$file.on('change drop',	function(e) {
		// If it's dropped
		$uploader.removeClass('over');
		e.stopPropagation();
		e.preventDefault();
		
		var files = this.files || e.originalEvent.dataTransfer.files;
		console.log(files)
	
		// Pour upload, voir : https://raw.github.com/Calvein/Simple-uploader/gh-pages/index.html
	});

	$uploader.on('dragenter dragleave', function(e) {
		$(this).toggleClass('over');
	});
	
	$uploader.on('dragover', function(e) {
		e.stopPropagation();
		e.preventDefault();
	});
	
	///////////////
	//   @TODO   //
	///////////////
	var subdirsof = '/';
	$.get('/tags', { subdirsof: subdirsof}, function(data) {
	    var text =  '<li><a href="{{url}}" title=""><i class="iconic arrow-right-alt"></i><span>{{label}}</span></a></li>',
            template = Hogan.compile(text),
            render = data.map(function (dir) {
          return template.render({url: dir.label, label: dir.label.replace(subdirsof, '') });
        }).join('');
        
	    $('#sub_directory ul').append(render)
	});
	
	// http://guacamole:3000/documents?tags=/
	/*
    $.get('/tags', { subdirsof: '/'}, function(data) {
        console.log(data);
        var text =  '{{#data}}\
                        <li><a href="#" title=""><i class="iconic arrow-right-alt"></i><span>{{label}}</span></a></li>\
                    {{/data}}';
        $('#sub_directory ul').append(Hogan.compile(text).render({ data: data }))
    });
    */
	
});	