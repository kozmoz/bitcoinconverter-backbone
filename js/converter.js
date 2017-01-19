'use strict';

// Namespace for our app.
var app = {};


//--------------
// Models
//--------------
app.ConverterStateModel = Backbone.Model.extend({

    defaults: {
        currency: 'EUR',
        direction: 'FROMBTC',
        amount: '1',
        exchangerateeur: 0,
        exchangerateusd: 0,
        exchangerateupdate: '',
        calculatedresult: 0
    },

    validate: function (attributes) {
        var amountString = attributes.amount;
        // Amount is not required but has to be a number.
        if (!amountString.match(/^\d*$/)) {
            return "Amount has to be a number";
        }
    }
});


//--------------
// Views
//--------------

// Listen to changes in currency selection.
app.AppView = Backbone.View.extend({
    el: '#converter-app',

    _exchangeRateTemplate: _.template($('#exchangerate-template').html()),

    initialize: function () {
        this.$selectbox = this.$('#currency');
        this.$amountinput = this.$('#amount');
        this.$amounterror = this.$('#amount-error');
        this.$exchangeRate = this.$('#exchangerate-block');
        this.$amountDirection = this.$('#amount-direction');

        // Retrieve Bitcoin exchange rate from MtGox.
        this.model.get('eurExchange').on('change', this._updateEurExchange, this).fetch();
        this.model.get('usdExchange').on('change', this._updateUsdExchange, this).fetch();

        // Show initial view.
        this.render();
    },

    events: {
        // Listen to currency selectbox changes.
        'change #currency': '_updateCurrency',
        // Update amount to exchange.
        'input #amount': '_updateAmount',
        // Update exchange direction.
        'change input[name=direction]': '_updateDirection'
    },

    /**
     * Update exchange rate to EUR (received from mtGox).
     */
    _updateEurExchange: function () {
        var eurExchangeModel = this.model.get('eurExchange');
        var now = eurExchangeModel.get('data').now;
        var value = eurExchangeModel.get('data').buy.value;

        if (now && value) {
            var date = new Date(now / 1000);
            var dateFormatted = date.format('yyyy/mm/dd HH:MM');
            this.model.set('exchangerateupdate', dateFormatted);
            this.model.set('exchangerateeur', value * 1);
            this.render();
        }
        // Update exchange rate periodically.
        setTimeout(function () {
            eurExchangeModel.fetch();
        }, 60000);
    },

    /**
     * Update exchange rate to USD (received from mtGox).
     */
    _updateUsdExchange: function () {
        var usdExchangeModel = this.model.get('usdExchange');
        var now = usdExchangeModel.get('data').now;
        var value = usdExchangeModel.get('data').buy.value;

        if (now && value) {
            var date = new Date(now / 1000);
            var dateFormatted = date.format('yyyy/mm/dd HH:MM');
            this.model.set('exchangerateupdate', dateFormatted);
            this.model.set('exchangerateusd', value * 1);
            this.render();
        }
        // Update exchange rate periodically.
        setTimeout(function () {
            usdExchangeModel.fetch();
        }, 60000);
    },

    _updateCurrency: function () {
        var currency = this.$selectbox.val();
        this.model.set('currency', currency);
        this.render();
    },

    _updateAmount: function () {
        var amount = this.$amountinput.val();
        var result = this.model.set('amount', amount, {validate: true});

        if (!result) {
            this.model.set('amounterror', 'Only numbers are allowed');
        } else {
            this.model.unset('amounterror');
        }

        this.render();
    },

    _updateDirection: function () {
        var direction = this.$('input[name=direction]:checked').val();
        this.model.set('direction', direction);
        this.render();
    },

    /**
     * Update calculation.
     */
    _calculateResult: function () {
        var amount = this.model.get('amount');
        var direction = this.model.get('direction');
        var currency = this.model.get('currency');
        var exchangeRateEur = this.model.get('exchangerateeur');
        var exchangeRateUsd = this.model.get('exchangerateusd');
        var calculatedresult = 0;

        if (direction == 'FROMBTC') {
            // Convert BTC to currency.
            if (currency == 'EUR') {
                calculatedresult = amount * exchangeRateEur;
            } else {
                calculatedresult = amount * exchangeRateUsd;
            }
        } else {
            // Convert to currency to BTC.
            if (currency == 'EUR') {
                calculatedresult = amount / exchangeRateEur;
            } else {
                calculatedresult = amount / exchangeRateUsd;
            }
        }

        this.model.set('calculatedresult', calculatedresult);
    },

    render: function () {
        // Render calculated results.
        this._calculateResult();
        var html = this._exchangeRateTemplate(this.model.attributes);
        this.$exchangeRate.html(html);

        // Update displayed label and amount prefix.
        this._renderAmountPrefix();
        this._renderLabels();

        this._renderAmountError();

        return this;
    },

    /**
     * Amount has to be a numeric.
     */
    _renderAmountError: function () {
        var amounterror = this.model.get('amounterror');
        this.$amounterror.toggleClass('hidden', !amounterror);
    },

    /**
     * Render prefix symbol of amount input field.
     */
    _renderAmountPrefix: function () {
        var direction = this.model.get('direction');
        var currency = this.model.get('currency');

        if (direction == 'FROMBTC') {
            this.$amountDirection.html('&#x0e3f;');
        } else {
            this.$amountDirection.html(currency == 'EUR' ? '&#x20ac;' : '$');
        }
    },

    /**
     * Update radio button labels.
     */
    _renderLabels: function () {
        // Update radio button label 1.
        var view = new app.ConvertFromBtcLabelView({model: this.model});
        this.$('#convert-from-btc-label').html(view.render().el);

        // Update radio button label 2.
        view = new app.ConvertToBtcLabelView({model: this.model});
        this.$('#convert-to-btc-label').html(view.render().el);
    }

});


// Renders radio button label.
app.ConvertFromBtcLabelView = Backbone.View.extend({
    tagName: 'span',
    _labelTemplate: _.template($('#convert-from-btc-label-template').html()),
    render: function () {
        this.$el.html(this._labelTemplate(this.model.attributes));
        return this;
    }
});
// Renders radio button label.
app.ConvertToBtcLabelView = Backbone.View.extend({
    tagName: 'span',
    _labelTemplate: _.template($('#convert-to-btc-label-template').html()),
    render: function () {
        this.$el.html(this._labelTemplate(this.model.attributes));
        return this;
    }
});


//--------------
// Initializers
//--------------

app.converterModel = new app.ConverterStateModel({
    'eurExchange': new (Backbone.Model.extend({
        url: 'https://data.mtgox.com/api/2/BTCEUR/money/ticker',
        defaults: { data: { buy: {value: 0}} }
    })),
    'usdExchange': new (Backbone.Model.extend({
        url: 'https://data.mtgox.com/api/2/BTCUSD/money/ticker',
        defaults: { data: { buy: {value: 0}} }
    }))
});

app.appView = new app.AppView({model: app.converterModel});
