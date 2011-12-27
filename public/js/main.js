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
	
	
});	