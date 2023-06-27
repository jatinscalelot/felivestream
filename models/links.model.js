let mongoose = require("mongoose");
let mongoosePaginate = require("mongoose-paginate-v2");
let schema = new mongoose.Schema({
    full_url: {
        type: String,
        required: true
    },
    short_url:{
        type: String,
        required: true
    },
    clicks: {
        type: Number,
        required: true,
        default: 0
    }
}, {timestamps: true, strict: false, autoIndex: true });
schema.plugin(mongoosePaginate);
module.exports = schema;