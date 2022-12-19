/**
 * @typedef {object} LinkToolData
 * @description Link Tool's input and output data format
 * @property {string} link — data url
 * @property {metaData} meta — fetched link data
 */

/**
 * @typedef {object} metaData
 * @description Fetched link meta data
 * @property {string} image - link's meta image
 * @property {string} title - link's meta title
 * @property {string} description - link's description
 */

// eslint-disable-next-line
import css from './index.css';
import ToolboxIcon from './svg/ic_products_black.svg';
import ajax from '@codexteam/ajax';
// eslint-disable-next-line
import polyfill from 'url-polyfill';

/**
 * @typedef {object} UploadResponseFormat
 * @description This format expected from backend on link data fetching
 * @property {number} success  - 1 for successful uploading, 0 for failure
 * @property {metaData} meta - Object with link data.
 *
 * Tool may have any data provided by backend, currently are supported by design:
 * title, description, image, url
 */
export default class ProductList {
  /**
   * Notify core that read-only mode supported
   *
   * @returns {boolean}
   */
  static get isReadOnlySupported() {
    return true;
  }

  /**
   * Get Tool toolbox settings
   * icon - Tool icon's SVG
   * title - title to show in toolbox
   *
   * @returns {{icon: string, title: string}}
   */
  static get toolbox() {
    return {
      icon: ToolboxIcon,
      title: 'ProductList',
    };
  }

  /**
   * Allow to press Enter inside the LinkTool input
   *
   * @returns {boolean}
   * @public
   */
  static get enableLineBreaks() {
    return true;
  }

  /**
   * @param {object} - previously saved data
   */
  constructor({ data, config, api, readOnly }) {
    this.api = api;
    this.readOnly = readOnly;

    /**
     * Tool's initial config
     */
    this.config = {
      endpoint: config.endpoint || '',
      headers: config.headers || {},
      acList: config.acList || {},
      placeholder: config.placeHolder || {},
      language: config.language || '',
    };

    this.nodes = {
      wrapper: null,
      container: null,
      progress: null,
      input: null,
      inputHolder: null,
      linkContent: null,
      anchor: null,
      bodyHolder: null,
      linkImage: null,
      linkTitle: null,
      linkDescription: null,
      textArrow: null,
      bodyInfo: null,
      infoWeek: null,
      infoPrice: null,
    };

    this._data = {
      link: '',
      meta: {},
    };

    this.url = '';
    this.select = null;
    this.input = null;
    this.formDeleteFunc = null;

    this.data = data;
  }

  /**
   * Renders Block content
   *
   * @public
   *
   * @returns {object} this.nodes.wrapper - render element wrapper
   */
  render() {
    this.nodes.wrapper = this.make('div', this.CSS.baseClass);
    this.nodes.container = this.make('div', this.CSS.container);

    this.nodes.inputHolder = this.makeInputHolder();
    this.nodes.linkContent = this.prepareLinkPreview();

    /**
     * If Tool already has data, render link preview, otherwise insert input
     */
    if (Object.keys(this.data.meta).length) {
      this.nodes.container.appendChild(this.nodes.linkContent);
      this.showLinkPreview(this.data.meta);
    } else {
      this.nodes.container.appendChild(this.nodes.inputHolder);
    }

    this.nodes.wrapper.appendChild(this.nodes.container);

    return this.nodes.wrapper;
  }

  /**
   * Return Block data
   *
   * @public
   *
   * @returns {LinkToolData}
   */
  save() {
    return this.data;
  }

  /**
   * Validate Block data
   * - check if given link is an empty string or not.
   *
   * @public
   *
   * @returns {boolean} false if saved data is incorrect, otherwise true
   */
  validate() {
    return this.data.link.trim() !== '';
  }

  /**
   * Stores all Tool's data
   *
   * @param {LinkToolData} data - fetch data
   */
  set data(data) {
    this._data = Object.assign({}, {
      link: data.link || this._data.link,
      meta: data.meta || this._data.meta,
    });
  }

  /**
   * Return Tool data
   *
   * @returns {LinkToolData}
   */
  get data() {
    return this._data;
  }

  /**
   * @returns {object} - Link Tool styles
   */
  get CSS() {
    return {
      baseClass: this.api.styles.block,
      input: this.api.styles.input,

      /**
       * Tool's classes
       */
      container: 'link-tool',
      inputEl: 'link-tool__input',
      inputHolder: 'link-tool__input-holder',
      inputError: 'link-tool__input-holder--error',
      linkContent: 'c-itemCardProductList__item',
      // linkContentRendered: 'link-tool__content--rendered',
      linkImage: 'c-itemCardProductList__item__pic',
      body: 'c-itemCardProductList__item__body',
      linkTitle: 'c-itemCardProductList__item__body__ttl',
      linkDescription: 'c-itemCardProductList__item__body__desc',
      textArrow: 'c-itemCardProductList__item__arrow',
      bodyInfo: 'c-itemCardProductList__item__body__info',
      infoWeek: 'c-itemCardProductList__item__body__info__week',
      infoPrice: 'c-itemCardProductList__item__body__info__price',
      progress: 'progress',
      progressLoading: 'loading',
      progressLoaded: 'loaded',
    };
  }

  /**
   * Prepare input holder
   *
   * @returns {object} inputHolder - make input holder
   */
  makeInputHolder() {
    const single = this.make('div', 'c-form-single');

    this.select = this.make('label', ['select', 'placeholder']);
    this.input = this.make('input', null, {
      placeholder: this.config.placeholder,
      type: 'search',
      id: 'productSelectFilter',
      // readOnly: true,
      value: '',
    });
    this.formDeleteFunc = (event) => {
      if (event.target.closest('.c-form-single .select') === null) {
        this.select.classList.remove('is-active');
      }
    };
    this.filteringProducts = (event) => {
      const inputValue = document.getElementById('productSelectFilter').value;
      const ulList = document.getElementById('productsList');

      ulList.innerHTML = '';
      this.filterProductsList(inputValue);
    };
    this.input.addEventListener('click', (e) => {
      if (this.select.classList.contains('is-active')) {
        e.preventDefault();
        e.stopPropagation();
      }
      this.select.classList.add('is-active');
      document.addEventListener('click', this.formDeleteFunc);
    });
    this.input.addEventListener('keyup', this.filteringProducts);
    this.select.appendChild(this.input);
    single.appendChild(this.select);

    const ul = this.make('ul', 'option', { id: 'productsList' });
    // this.makeProductsList(this.config.acList);

    this.config.acList.map((list) => {
      const url = list.url;
      const title = list.title;
      const link = this.make('li', null, { value: url });

      link.textContent = title;
      link.addEventListener('click', () => {
        this.url = url;
        this.input.value = title;
        this.select.classList.remove('is-active');
        this.startFetching();
      });
      ul.appendChild(link);
    });
    single.appendChild(ul);

    this.nodes.progress = this.make('label', this.CSS.progress);
    this.select.appendChild(this.nodes.progress);

    return single;
  }

  /**
   * replaceFullWidthCharactersWithHalfWidth
   *
   * @returns {string}
   * @param {string} s - text
   */
  replaceFullWidthCharactersWithHalfWidth(s) {
    return s.replace(/[\uff01-\uff5e]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
    });
  }

  /**
   * Make Products List
   *
   * @param {Array} pList - prodcts list
   */
  makeProductsList(pList) {
    const ulList = document.getElementById('productsList');

    pList.map((list) => {
      const url = list.url;
      const title = list.title;
      const link = this.make('li', null, { value: url });

      link.textContent = title;
      link.addEventListener('click', () => {
        this.url = url;
        this.input.value = title;
        this.select.classList.remove('is-active');
        this.startFetching();
      });
      ulList.appendChild(link);
    });
  }

  /**
   * filtering Products List
   *
   * @param {string} filterText - filter text
   */
  filterProductsList(filterText) {
    const text = this.replaceFullWidthCharactersWithHalfWidth(filterText.toLowerCase());

    if (text == '') {
      this.makeProductsList(this.config.acList);
    } else {
      const productsList = this.config.acList.filter((product) => {
        return this.replaceFullWidthCharactersWithHalfWidth(product.title.toLowerCase()).includes(text);
      });

      this.makeProductsList(productsList);
    }
  }

  /**
   * Activates link data fetching by url
   */
  startFetching() {
    const url = this.url;

    this.removeErrorStyle();
    this.fetchLinkData(url);
  }

  /**
   * If previous link data fetching failed, remove error styles
   */
  removeErrorStyle() {
    this.nodes.inputHolder.classList.remove(this.CSS.inputError);
  }

  /**
   * Prepare link preview holder
   *
   * @returns {object} holder - return prepare render html element
   */
  prepareLinkPreview() {
    const holder = this.make('div', this.CSS.linkContent);

    this.nodes.anchor = this.make('a', null, {
      target: '_blank',
      rel: 'nofollow noindex noreferrer',
    });
    holder.appendChild(this.nodes.anchor);

    this.nodes.linkImage = this.make('div', this.CSS.linkImage);
    this.nodes.linkTitle = this.make('h3', this.CSS.linkTitle);
    this.nodes.linkDescription = this.make('p', this.CSS.linkDescription);
    // this.nodes.textArrow = this.make('i', this.CSS.textArrow, { style: 'border-color:#0094CC;' });
    this.nodes.textArrow = this.make('i', this.CSS.textArrow);

    return holder;
  }

  /**
   * Compose link preview from fetched data
   *
   * @param {metaData} meta - link meta data
   */
  showLinkPreview(meta) {
    this.nodes.container.appendChild(this.nodes.linkContent);

    if (meta.image) {
      const img = this.make('img', null, { src: meta.image });

      this.nodes.linkImage.appendChild(img);
      // this.nodes.linkImage.style.backgroundImage = 'url(' + image.url + ')';
      this.nodes.anchor.appendChild(this.nodes.linkImage);
    }

    this.nodes.bodyHolder = this.make('div', this.CSS.body);
    if (meta.title) {
      this.nodes.linkTitle.textContent = meta.title;
      this.nodes.bodyHolder.appendChild(this.nodes.linkTitle);
    }

    if (meta.description) {
      this.nodes.linkDescription.textContent = meta.description;
      this.nodes.bodyHolder.appendChild(this.nodes.linkDescription);
    }
    this.nodes.anchor.appendChild(this.nodes.bodyHolder);
    this.nodes.anchor.appendChild(this.nodes.textArrow);

    this.nodes.anchor.setAttribute('href', this.data.link);

    // TODO if week and price
    if (meta.lowest_price_gross || meta.operating_days_of_week) {
      this.nodes.bodyInfo = this.make('div', this.CSS.bodyInfo);

      if (meta.operating_days_of_week) {
        this.nodes.infoWeek = this.make('p', this.CSS.infoWeek);
        this.nodes.infoWeek.textContent = meta.operating_days_of_week;
        this.nodes.bodyInfo.appendChild(this.nodes.infoWeek);
      }

      if (meta.lowest_price_gross) {
        // this.nodes.infoPrice = this.make('p', this.CSS.infoPrice, { style: 'color:#0094CC' });
        this.nodes.infoPrice = this.make('p', this.CSS.infoPrice);
        const regex = new RegExp(/円/);
        let price = meta.lowest_price_gross;

        if (this.config.language !== 'ja-JP') {
          if (regex.test(price)) {
            price = 'JPY ' + price.replace('円', '');
          }
        }
        this.nodes.infoPrice.textContent = price;
        this.nodes.bodyInfo.appendChild(this.nodes.infoPrice);
      }

      this.nodes.bodyHolder.appendChild(this.nodes.bodyInfo);
    }

    try {
      const getHost = (new URL(this.data.link)).hostname;

      if (!getHost) {
        console.error("can't get host name");
      }
    } catch (e) {
      this.nodes.linkText.textContent = this.data.link;
    }
  }

  /**
   * Show loading progressbar
   *
   * @returns {void}
   */
  showProgress() {
    this.nodes.progress.classList.add(this.CSS.progressLoading);
  }

  /**
   * Hide loading progressbar
   *
   * @returns {void}
   */
  hideProgress() {
    return new Promise((resolve) => {
      this.nodes.progress.classList.remove(this.CSS.progressLoading);
      this.nodes.progress.classList.add(this.CSS.progressLoaded);

      setTimeout(resolve, 500);
    });
  }

  /**
   * If data fetching failed, set input error style
   *
   * @returns {void}
   */
  applyErrorStyle() {
    this.nodes.inputHolder.classList.add(this.CSS.inputError);
    this.select.remove();
  }

  /**
   * Sends to backend pasted url and receives link data
   *
   * @param {string} url - link source url
   */
  async fetchLinkData(url) {
    this.showProgress();
    this.data = { link: url };

    try {
      const { body, code } = await (ajax.get({
        url: this.config.endpoint,
        headers: this.headers,
        data: { url: url },
      }));

      // this.onFetch(this.testBody, code);
      this.onFetch(body, code);
    } catch (error) {
      this.fetchingFailed(this.api.i18n.t('Couldn\'t fetch the link data'));
    }
  }

  /**
   * Link data fetching callback
   *
   * @param {UploadResponseFormat} response - response data
   * @param {number} code - status code
   */
  onFetch(response, code) {
    if (code >= 400) {
      this.fetchingFailed(this.api.i18n.t('Couldn\'t get this link data, try the other one'));
      console.error(response);

      return;
    }

    const metaData = response;

    const link = response.link || this.data.link;

    this.data = {
      meta: metaData,
      link,
    };

    if (!metaData) {
      this.fetchingFailed(this.api.i18n.t('Wrong response format from the server'));

      return;
    }

    this.hideProgress().then(() => {
      this.nodes.inputHolder.remove();
      this.showLinkPreview(metaData);
    });
  }

  /**
   * Handle link fetching errors
   *
   * @private
   *
   * @param {string} errorMessage - errorMessage
   */
  fetchingFailed(errorMessage) {
    this.api.notifier.show({
      message: errorMessage,
      style: 'error',
    });

    this.applyErrorStyle();
  }

  /**
   * Helper method for elements creation
   *
   * @param {string} tagName - html element name
   * @param {string} classNames - class name
   * @param {object} attributes - attribute param
   * @returns {object} - return html element
   */
  make(tagName, classNames = null, attributes = {}) {
    const el = document.createElement(tagName);

    if (Array.isArray(classNames)) {
      el.classList.add(...classNames);
    } else if (classNames) {
      el.classList.add(classNames);
    }

    for (const attrName in attributes) {
      el[attrName] = attributes[attrName];
    }

    return el;
  }
}
