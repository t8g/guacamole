;(function($) {

    $.dirSelector = function(el, options) {

        var defaults = {
            dir: '/'
           //propertyName: 'value',
           //onSomeEvent: function() {}
        }

        var plugin = this;
        plugin.settings = {}

        var init = function() {
            plugin.settings = $.extend({}, defaults, options);
            plugin.el = el;
            addSelect(plugin.settings.dir);
        }

        var addSelect = function(dir, dirname) {
            var li = $('<li class="dropdown" data-dropdown="dropdown"><a class="dropdown-toggle">' + (dirname || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;') + '</a><ul class="dropdown-menu"></lu></li>')
                , dirs = dir.split('/')
                , fulldirname = dir + (dirname || '/')
                ;

            plugin.el.prepend(li);

            $.get('/tags', { subdirsof: dir || '/'}, function(data) {
                var ul = li.find('ul');
                data.forEach(function(item) {
                    //ul.append()
                    if (fulldirname !== item.label)
                        ul.append($('<li><a href="#' + item.label + '">' + item.label.replace(dir, '') + '</a></li>')).find('a').on('click', function(ev) {
                            ev.preventDefault();
                            plugin.el.empty();
                            addSelect(this.hash.substr(1));
                        });
                });
            });

            // réccurence
            dirname = dirs.pop();
            if (dir.length) addSelect(dirs.join('/'), '/' + dirname);
        }

/*
        plugin.foo_public_method = function() {
            // code goes here
        }
*/
        init();

    }

})(jQuery);