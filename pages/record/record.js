const app = getApp();
const { recordApi, categoryApi } = require('../../utils/db');
const { formatDate, formatAmount, DEFAULT_SUB_CATEGORIES } = require('../../utils/util');

const DEFAULT_EXPENSE_CATEGORIES = ['餐饮', '交通', '购物', '娱乐', '居住', '医疗', '教育', '通讯', '人情', '其他'];
const DEFAULT_INCOME_CATEGORIES = ['工资', '奖金', '投资收益', '兼职', '礼金', '退款', '其他'];

Page({
  data: {
    isEdit: false,
    recordId: '',
    type: 'expense',
    recordMode: 'simple',
    category: '',
    subCategory: '',
    amount: '',
    date: '',
    note: '',
    categories: [],
    subCategories: [],
    showSubCategoryPicker: false,
    showNewCategoryModal: false,
    showNewSubCategoryModal: false,
    newCategoryName: '',
    newSubCategoryName: ''
  },

  async onLoad(options) {
    await app.loginPromise.catch(() => {});

    const recordMode = app.globalData.recordMode;
    const date = formatDate(new Date());
    this.setData({ recordMode, date });

    if (options.id) {
      this.setData({ isEdit: true, recordId: options.id });
      await this.loadRecord(options.id);
    }

    await this.loadCategories();
  },

  async loadRecord(id) {
    try {
      const db = wx.cloud.database();
      const res = await db.collection('records').doc(id).get();
      const record = res.data;

      this.setData({
        type: record.type,
        category: record.category,
        subCategory: record.subCategory || '',
        amount: formatAmount(record.amount),
        date: formatDate(new Date(record.date)),
        note: record.note || ''
      });

      if (record.subCategory) {
        await this.loadSubCategories(record.category);
      }
    } catch (err) {
      wx.showToast({ title: '加载记录失败', icon: 'none' });
    }
  },

  async loadCategories() {
    try {
      const openid = app.globalData.userInfo._openid;
      const type = this.data.type;

      let categories = await categoryApi.getCategories(openid, type);

      const seen = new Set();
      categories = categories.filter(c => {
        if (seen.has(c.name)) return false;
        seen.add(c.name);
        return true;
      });

      if (categories.length === 0) {
        const defaults = type === 'expense' ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES;
        categories = defaults.map((name, index) => ({
          _openid: openid,
          type,
          name,
          icon: '',
          sortOrder: index,
          isDefault: true
        }));

        for (const cat of categories) {
          await categoryApi.addCategory(cat);
        }

        categories = await categoryApi.getCategories(openid, type);
      }

      this.setData({ categories });

      if (this.data.category) {
        await this.loadSubCategories(this.data.category);
      }
    } catch (err) {
      console.error('加载分类失败', err);
    }
  },

  async loadSubCategories(parentCategory) {
    try {
      const openid = app.globalData.userInfo._openid;
      let subCategories = await categoryApi.getSubCategories(openid, parentCategory);

      const seen = new Set();
      subCategories = subCategories.filter(s => {
        if (seen.has(s.name)) return false;
        seen.add(s.name);
        return true;
      });

      if (subCategories.length === 0) {
        const defaults = DEFAULT_SUB_CATEGORIES[parentCategory];
        if (defaults) {
          for (let i = 0; i < defaults.length; i++) {
            await categoryApi.addSubCategory({
              _openid: openid,
              parentCategory,
              name: defaults[i],
              sortOrder: i
            });
          }
          subCategories = await categoryApi.getSubCategories(openid, parentCategory);
        }
      }

      this.setData({ subCategories, showSubCategoryPicker: true });
    } catch (err) {
      console.error('加载子分类失败', err);
    }
  },

  onTypeChange(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ type, category: '', subCategory: '', subCategories: [] });
    this.loadCategories();
  },

  onCategorySelect(e) {
    const category = e.currentTarget.dataset.name;
    const isSame = this.data.category === category;

    if (isSame) {
      this.setData({ category: '', subCategory: '', subCategories: [] });
    } else {
      this.setData({ category, subCategory: '', subCategories: [] });
      this.loadSubCategories(category);
    }
  },

  onSubCategorySelect(e) {
    this.setData({ subCategory: e.currentTarget.dataset.name });
  },

  showNewCategoryModal() {
    this.setData({ showNewCategoryModal: true, newCategoryName: '' });
  },

  hideNewCategoryModal() {
    this.setData({ showNewCategoryModal: false });
  },

  onNewCategoryInput(e) {
    this.setData({ newCategoryName: e.detail.value });
  },

  async saveNewCategory() {
    const name = this.data.newCategoryName.trim();
    if (!name) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' });
      return;
    }

    const exists = this.data.categories.some(c => c.name === name);
    if (exists) {
      wx.showToast({ title: '分类已存在', icon: 'none' });
      return;
    }

    const openid = app.globalData.userInfo?._openid;
    if (!openid) {
      wx.showToast({ title: '用户未登录', icon: 'none' });
      return;
    }

    try {
      await categoryApi.addCategory({
        type: this.data.type,
        name,
        icon: '',
        sortOrder: this.data.categories.length,
        isDefault: false
      });

      wx.showToast({ title: '添加成功', icon: 'success' });
      this.setData({ showNewCategoryModal: false, newCategoryName: '' });
      await this.loadCategories();

      const newCat = this.data.categories.find(c => c.name === name);
      if (newCat) {
        this.setData({ category: newCat.name, subCategory: '', subCategories: [] });
        this.loadSubCategories(newCat.name);
      }
    } catch (err) {
      console.error('添加分类失败', err);
      wx.showToast({ title: '添加失败：' + (err.message || '未知错误'), icon: 'none' });
    }
  },

  showNewSubCategoryModal() {
    this.setData({ showNewSubCategoryModal: true, newSubCategoryName: '' });
  },

  hideNewSubCategoryModal() {
    this.setData({ showNewSubCategoryModal: false });
  },

  onNewSubCategoryInput(e) {
    this.setData({ newSubCategoryName: e.detail.value });
  },

  async saveNewSubCategory() {
    const name = this.data.newSubCategoryName.trim();
    if (!name) {
      wx.showToast({ title: '请输入子分类名称', icon: 'none' });
      return;
    }

    const exists = this.data.subCategories.some(s => s.name === name);
    if (exists) {
      wx.showToast({ title: '子分类已存在', icon: 'none' });
      return;
    }

    const openid = app.globalData.userInfo?._openid;
    if (!openid) {
      wx.showToast({ title: '用户未登录', icon: 'none' });
      return;
    }

    try {
      await categoryApi.addSubCategory({
        parentCategory: this.data.category,
        name,
        sortOrder: this.data.subCategories.length
      });

      wx.showToast({ title: '添加成功', icon: 'success' });
      this.setData({ showNewSubCategoryModal: false, newSubCategoryName: '' });
      await this.loadSubCategories(this.data.category);

      const newSub = this.data.subCategories.find(s => s.name === name);
      if (newSub) {
        this.setData({ subCategory: newSub.name });
      }
    } catch (err) {
      console.error('添加子分类失败', err);
      wx.showToast({ title: '添加失败：' + (err.message || '未知错误'), icon: 'none' });
    }
  },

  preventBubble() {
    // 阻止弹窗内容点击冒泡关闭
  },

  onAmountInput(e) {
    let value = e.detail.value;
    value = value.replace(/[^\d.]/g, '');
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    if (parts[1] && parts[1].length > 2) {
      value = parts[0] + '.' + parts[1].substring(0, 2);
    }
    this.setData({ amount: value });
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value });
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value });
  },

  validate() {
    if (!this.data.category) {
      wx.showToast({ title: '请选择分类', icon: 'none' });
      return false;
    }
    if (!this.data.amount || parseFloat(this.data.amount) <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' });
      return false;
    }
    return true;
  },

  async saveRecord() {
    if (!this.validate()) return;

    const openid = app.globalData.userInfo._openid;
    const familyId = app.globalData.userInfo.familyId || '';

    const data = {
      openid,
      familyId,
      type: this.data.type,
      category: this.data.category,
      subCategory: this.data.recordMode === 'detailed' ? this.data.subCategory : '',
      amount: parseFloat(this.data.amount),
      date: new Date(this.data.date),
      note: this.data.note
    };

    try {
      if (this.data.isEdit) {
        await recordApi.updateRecord(this.data.recordId, data);
      } else {
        await recordApi.addRecord(data);
      }

      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  }
});
