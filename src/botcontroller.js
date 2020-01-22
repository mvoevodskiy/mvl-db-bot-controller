const Keyboard = require('botcms/lib/keyboard');
const {Op} = require('sequelize');
/**
 * @class BotToDBController
 *
 * @property {MVLoader}
 * @property {MVTools}
 * @property {BotCMS} Bot
 * @property {Sequelize} DB
 * @property {Model} Model
 * @property
 */
class BotToDBController {
    caption = '';
    config = {};
    defaults = {
        BotHandler: 'BotHandler',
        fields: {
            singleButton: 'name',
        },
        keyboards: {
            manage_object: 'manage_object',
        },
        lexicons: {
            choose_from_list: 'common.msg.choose_from_list',
            details: 'common.msg.details',
        },
        path: {
            answers_single_query: 'answers.manage_objects.query.answer',
            answers_add: 'answers.manage_objects_add',
            answers_selected: 'answers.manage_objects.selected.answer',
            manage: 'c.manage',
        },
    };
    modelName = '';

    constructor (App, config = {}) {
        this.App = App;
        this.MT = this.App.MT;
        this.loadConfig(config);
    }

    loadConfig (config) {
        this.config = this.MT.mergeRecursive(this.defaults, this.config, config);
    }

    initFinish () {
        this.Bot = this.App.ext.handlers[this.config.BotHandler].Bot;
        this.DB = this.App.DB;
        this.Model = this.DB.models[this.modelName];
    }

    getAll = (ctx) => {
        this.Model.findAll()
            .then(contractors => {
                let parcel = this.newParcel();
                parcel.message = JSON.stringify(contractors, null, 4);
                parcel.keyboard = (new Keyboard(ctx)).addBtnMenuMain().addBtnBack().build();
                ctx.reply(parcel);
            });
    };

    find_vld = (ctx) => {
        // console.log('MVLBA MESSAGE: ' + ctx.msg);
        // console.log('MVLBA CRITERIA: ', criteria);
        // console.log();
        let criteria = {where: {name: {[Op.like]: '%' + ctx.msg + '%',}}};
        return this.Model.count(criteria)
            .then(count => count > 0);
    };

    list_act = (ctx) => {
        let q = this.MT.extract(this.config.path.answers_single_query, ctx.session);
        let criteria = {
            where: {},
            limit: 12,
        };
        criteria.where[this.config.fields.singleButton] = {[Op.like]: '%' + ctx.msg + '%',};
        return this.Model.findAll(criteria)
            .then(contractors => {
                let kb = new Keyboard(ctx);
                for (let contractor of contractors) {
                    kb.addBtn(contractor[this.config.fields.singleButton]);
                }
                let parcel = this.newParcel();
                parcel.message = ctx.lexicon(this.config.lexicons.choose_from_list);
                parcel.keyboard = kb.addBtnMenuManage().addBtnMenuMain().build();
                ctx.reply(parcel);
            });
    };

    add_act = async (ctx) => {
        let contractor = {};
        let answers = this.MT.extract(this.config.path.answers_add, ctx.session);
        console.log(answers);
        for (let key in answers) {
            if (answers.hasOwnProperty(key)) {
                contractor[key] = answers[key].answer;
            }
        }
        this.Model.create(contractor)
            .then(created => {
                console.log(created);
                if (!this.MT.empty(created)) {
                    let parcel = this.newParcel();
                    parcel.message = ctx.lexicon(this.config.lexicons.details, created.get());
                    ctx.reply(parcel);
                    let step = ctx.BC.Scripts.extract(this.config.path.manage);
                    return ctx.BC.doUpdate(step, ctx);
                }
            });
    };

    singleManageActions_act = async (ctx) => {
        let q = this.MT.extract(this.config.path.answers_selected, ctx.session);
        let criteria = {where: {name: q}};
        let contractor = await this.Model.findOne(criteria);
        // contractor.get()
        if (!this.MT.empty(contractor)) {
            let kb = new Keyboard(ctx);
            let parcel = this.newParcel();
            parcel.message = ctx.lexicon(this.config.lexicons.details, contractor.get());
            parcel.keyboard = kb.fromKBObject(ctx.BC.keyboards[this.config.keyboards.manage_object] || {}).build();
            ctx.reply(parcel);
        }
    };

    btns = (ctx) => {
        let parcel = this.newParcel();
        parcel.message = 'Кнопки';
        let kb = new Keyboard(ctx);
        parcel.keyboard = kb.addBtnMenuMain().addBtnBack().build();
        ctx.reply(parcel);
    };

    newParcel = () => new this.Bot.config.classes.Parcel();

}

module.exports = BotToDBController;