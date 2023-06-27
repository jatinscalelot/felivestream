let mongoose = require("mongoose");
let mongoosePaginate = require("mongoose-paginate-v2");
let discountSchema = new mongoose.Schema({
	discountname: { 
        type: String,
		trim: true,
		required: true,
    },
    discounttype: { 
        type: String,
		trim: true,
		required: true,
    },
    description: { 
        type: String,
        default: ''
    },
    discount: { 
        type: String,
		trim: true,
		required: true,
    },
    tandc: { 
        type: String,
		default: ''
    },
    items:[]
}, { _id: false });
let arrangementSchema = new mongoose.Schema({
    seating_item : {
        type: mongoose.Types.ObjectId,
        require : true
    },
    arrangements : [],
    food : {
        type: String,
		default: ''
    },
    food_description : {
        type: String,
		default: ''
    },
    equipment : {
        type: Boolean,
		default: false
    },
    equipment_description : {
        type: String,
		default: ''
    },
    totalCalculations : {
        total_number_of_seating_items : {
            type : Number,
            default: 0
        },
        total_per_seating_persons : {
            type : Number,
            default: 0
        },
        total_persons : {
            type : Number,
            default: 0
        },
        per_seating_price : {
            type : Number,
            default: 0
        },
        per_person_price : {
            type : Number,
            default: 0
        },
        total_amount : {
            type : Number,
            default: 0
        },
        total_booked : {
            type : Number,
            default: 0
        }
    }
}, {_id: false});
let schema = new mongoose.Schema({
    event_category : {
        type: mongoose.Types.ObjectId,
		default: null
    },
    event_location : {
        location: {
            type: {
                type: String,
                enum: ['Point']
            },
            coordinates: {
                type: [Number]
            }
        }
    },
    discounts : [discountSchema],
    seating_arrangements : [arrangementSchema],
	createdBy: {
		type: mongoose.Types.ObjectId,
		default: null
	},
	updatedBy: {
		type: mongoose.Types.ObjectId,
		default: null
	}
}, { timestamps: true, strict: false, autoIndex: true });
schema.plugin(mongoosePaginate);
schema.index({ "event_location.location" : "2dsphere" });
module.exports = schema;