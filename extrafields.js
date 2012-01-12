module.exports = {
    'extra': {
        type: String,
        get: function(v) {
            return v ? v + ' PLOP' : '';
        }
    }
}