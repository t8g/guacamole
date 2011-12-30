$(function() {
    // jQuery objects
    var $breadcrumb = $('.breadcrumb')
      , $subDirectory = $('#sub_directory ul')
      , $documents = $('#documents')
      , $tags = $('#tags');

    var changeState = function(e) {
        e.preventDefault();
        var url = e.currentTarget.pathname ? e.currentTarget.pathname + e.currentTarget.search : e.target.location.pathname + e.target.location.search;
        history.pushState({}, 'guacamole', url);
        changeContent(url, e.type === 'popstate');
    }

    $breadcrumb.on('click', 'a', changeState)
    $subDirectory.on('click', 'a', changeState)
    window.addEventListener('popstate', changeState);

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
                        <tr>\
                            <td><a href="/documents/{{id}}/file">{{title}}<img src="/documents/{{id}}/thumbnail" /></a>\
                            <td>{{created_at}}\
                            <td>{{size}} ko\
                            <td>{{mime}}\
                            <td><input type="checkbox" name="optionsCheckboxes" />\
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

            $documents.find('tbody').html(render).end()
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