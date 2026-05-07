const app = getApp();
const { categoryApi } = require('../../utils/db');
const { DEFAULT_SUB_CATEGORIES } = require('../../utils/util');

Page({
  data: {
    type: 'expense',
    recordMode: 'simple',
    categories: [],
    currentCategory: null,
    subCategories: [],
    showSubManage: false,
    showAddModal: false,
    showSubAddModal: false,
    newCategoryName: '',
    newSubCategoryName: '',
    editingCategory: null,
    editingSubCategory: null
  },

  async onLoad() {
    await app.loginPromise.catch(() => {});
    this.setData({ recordMode: app.globalData.recordMode });
    this.loadCategories();
  },

  async loadCategories() {
    try {
      const openid = app.globalData.userInfo._openid;
      const categories = await categoryApi.getCategories(openid, this.data.type);
      this.setData({ categories });
    } catch (err) {
      console.error('加载分类失败', err);
    }
  },

  onTypeChange(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ type, showSubManage: false, currentCategory: null });
    this.loadCategories();
  },

  async onCategoryTap(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({ currentCategory: category, showSubManage: true });

    if (this.data.recordMode === 'detailed') {
      await this.loadSubCategories(category.name);
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

      this.setData({ subCategories });
    } catch (err) {
      console.error('加载子分类失败', err);
    }
  },

  showAddCategory() {
    this.setData({
      showAddModal: true,
      newCategoryName: '',
      editingCategory: null
    });
  },

  hideAddModal() {
    this.setData({ showAddModal: false });
  },

  onCategoryNameInput(e) {
    this.setData({ newCategoryName: e.detail.value });
  },

  async saveCategory() {
    const name = this.data.newCategoryName.trim();
    if (!name) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' });
      return;
    }

    try {
      const openid = app.globalData.userInfo._openid;

      if (this.data.editingCategory) {
        await categoryApi.updateCategory(this.data.editingCategory._id, { name });
      } else {
        await categoryApi.addCategory({
          _openid: openid,
          type: this.data.type,
          name,
          icon: '',
          sortOrder: this.data.categories.length,
          isDefault: false
        });
      }

      this.setData({ showAddModal: false });
      this.loadCategories();
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  async deleteCategory(e) {
    const category = e.currentTarget.dataset.category;
    const res = await wx.showModal({
      title: '确认删除',
      content: `删除「${category.name}」后，该分类及其子分类将从列表中移除，但历史记录和统计不受影响。`,
      confirmColor: '#fa5151'
    });

    if (!res.confirm) return;

    try {
      await categoryApi.deleteCategory(category._id);
      await categoryApi.deleteSubCategoriesByParent(
        app.globalData.userInfo._openid,
        category.name
      );

      wx.showToast({ title: '已删除', icon: 'success' });
      this.setData({ showSubManage: false, currentCategory: null });
      this.loadCategories();
    } catch (err) {
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  editCategory(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({
      showAddModal: true,
      newCategoryName: category.name,
      editingCategory: category
    });
  },

  showAddSubCategory() {
    this.setData({
      showSubAddModal: true,
      newSubCategoryName: '',
      editingSubCategory: null
    });
  },

  hideSubAddModal() {
    this.setData({ showSubAddModal: false });
  },

  onSubCategoryNameInput(e) {
    this.setData({ newSubCategoryName: e.detail.value });
  },

  async saveSubCategory() {
    const name = this.data.newSubCategoryName.trim();
    if (!name) {
      wx.showToast({ title: '请输入子分类名称', icon: 'none' });
      return;
    }

    try {
      const openid = app.globalData.userInfo._openid;

      if (this.data.editingSubCategory) {
        await categoryApi.updateSubCategory(this.data.editingSubCategory._id, { name });
      } else {
        await categoryApi.addSubCategory({
          _openid: openid,
          parentCategory: this.data.currentCategory.name,
          name,
          sortOrder: this.data.subCategories.length
        });
      }

      this.setData({ showSubAddModal: false });
      this.loadSubCategories(this.data.currentCategory.name);
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  async deleteSubCategory(e) {
    const subCategory = e.currentTarget.dataset.item;
    const res = await wx.showModal({
      title: '确认删除',
      content: `确定要删除「${subCategory.name}」吗？`,
      confirmColor: '#fa5151'
    });

    if (!res.confirm) return;

    try {
      await categoryApi.deleteSubCategory(subCategory._id);
      wx.showToast({ title: '已删除', icon: 'success' });
      this.loadSubCategories(this.data.currentCategory.name);
    } catch (err) {
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  editSubCategory(e) {
    const subCategory = e.currentTarget.dataset.item;
    this.setData({
      showSubAddModal: true,
      newSubCategoryName: subCategory.name,
      editingSubCategory: subCategory
    });
  },

  backToCategories() {
    this.setData({ showSubManage: false, currentCategory: null });
  }
});
