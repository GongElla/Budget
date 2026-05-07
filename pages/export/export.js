const app = getApp();
const { formatMonth } = require('../../utils/util');

Page({
  data: {
    startMonth: '',
    endMonth: '',
    exporting: false,
    downloadUrl: ''
  },

  async onLoad() {
    await app.loginPromise.catch(() => {});
    const currentMonth = formatMonth(new Date());
    this.setData({ startMonth: currentMonth, endMonth: currentMonth });
  },

  onStartMonthChange(e) {
    this.setData({ startMonth: e.detail.value });
  },

  onEndMonthChange(e) {
    this.setData({ endMonth: e.detail.value });
  },

  async exportExcel() {
    const { startMonth, endMonth } = this.data;

    if (startMonth > endMonth) {
      wx.showToast({ title: '开始月份不能大于结束月份', icon: 'none' });
      return;
    }

    this.setData({ exporting: true });

    try {
      const openid = app.globalData.userInfo._openid;
      const res = await wx.cloud.callFunction({
        name: 'exportExcel',
        data: { openid, startMonth, endMonth }
      });

      if (res.result.fileID) {
        const fileRes = await wx.cloud.getTempFileURL({
          fileList: [res.result.fileID]
        });

        if (fileRes.fileList[0]?.tempFileURL) {
          this.setData({
            downloadUrl: fileRes.fileList[0].tempFileURL,
            exporting: false
          });
          wx.showToast({ title: '导出成功', icon: 'success' });
        }
      }
    } catch (err) {
      console.error('导出失败', err);
      wx.showToast({ title: '导出失败', icon: 'none' });
      this.setData({ exporting: false });
    }
  },

  downloadFile() {
    const url = this.data.downloadUrl;
    if (!url) return;

    wx.showLoading({ title: '下载中' });
    wx.downloadFile({
      url,
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200) {
          wx.openDocument({
            filePath: res.tempFilePath,
            showMenu: true,
            success: () => wx.showToast({ title: '打开成功', icon: 'success' })
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '下载失败', icon: 'none' });
      }
    });
  }
});
