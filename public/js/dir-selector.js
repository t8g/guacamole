;(function($) {

    $.fn.dirSelector = function(options) {

        var defaults = {
            dir: '/'
           //propertyName: 'value',
           //onSomeEvent: function() {}
        }

        var plugin = {};
        plugin.el = $(this).empty();
        plugin.settings = {}

        var init = function() {
            plugin.settings = $.extend({}, defaults, options);
            addSelect(plugin.settings.dir);
        }

        var addSelect = function(dir, dirname) {
            var li = $('<li class="dropdown" data-dropdown="dropdown"><a href="#" class="dropdown-toggle">' + (dirname || '<i class="iconic link"></i>') + '</a><ul class="dropdown-menu"></lu></li>')
                , dirs = dir.split('/')
                , fulldirname = dir + (dirname || '/')
                ;

            plugin.el.prepend(li);

            $.get('/tags', { subdirsof: dir || '/'}, function(data) {
                var ul = li.find('ul');

                data.unshift({label: dir || '/'});
                data.forEach(function(item) {
                    ul.append($('<li><a href="#' + item.label + '">' + (item.label.replace(dir, '') || '---') + '</a></li>')).find('a').on('click', function(ev) {
                        ev.preventDefault();
                        plugin.el.empty();
                        var newdir = this.hash.substr(1);
                        // Si il ne comporte qu'un caractère, c'est le /
                        if (newdir.length === 1) newdir = '';
                        if (plugin.settings.input) plugin.settings.input.val(newdir);
                        addSelect(newdir);
                    });
                });
            });

            // réccurence
            dirname = dirs.pop();
            if (dir.length) addSelect(dirs.join('/'), '/' + dirname);
        }

        // plugin.foo_public_method = function() {
        //     // code goes here
        // }

        init();
        
        return this;
    }

})(jQuery);