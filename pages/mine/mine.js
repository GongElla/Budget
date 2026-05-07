const app = getApp();

Page({
  data: {
    userInfo: null,
    recordMode: 'simple',
    familyId: ''
  },

  onLoad() {
    this.updateUserInfo();
  },

  onShow() {
    this.updateUserInfo();
  },

  updateUserInfo() {
    const userInfo = app.globalData.userInfo;
    this.setData({
      userInfo,
      recordMode: app.globalData.recordMode,
      familyId: userInfo?.familyId || ''
    });
  },

  async switchRecordMode() {
    const currentMode = this.data.recordMode;
    const newMode = currentMode === 'simple' ? 'detailed' : 'simple';
    const modeText = newMode === 'simple' ? '极简模式' : '详细模式';

    const res = await wx.showModal({
      title: '切换记账模式',
      content: `确定切换到${modeText}吗？切换后新记录将采用新模式，历史记录不变。`,
      confirmText: '切换'
    });

    if (!res.confirm) return;

    try {
      const openid = this.data.userInfo._openid;
      const db = wx.cloud.database();
      await db.collection('users').doc(openid).update({
        data: { recordMode: newMode }
      });

      app.globalData.recordMode = newMode;
      this.setData({ recordMode: newMode });
      wx.showToast({ title: `已切换至${modeText}`, icon: 'success' });
    } catch (err) {
      wx.showToast({ title: '切换失败', icon: 'none' });
    }
  },

  goToCategory() {
    wx.navigateTo({ url: '/pages/category/category' });
  },

  goToExport() {
    wx.navigateTo({ url: '/pages/export/export' });
  },

  goToFamily() {
    wx.switchTab({ url: '/pages/family/family' });
  }
});
