const app = getApp();
const { formatMonth } = require('../../utils/util');

Page({
  data: {
    startMonth: '',
    endMonth: '',
    exporting: false,
    downloadUrl: '',
    fileID: ''
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
            fileID: res.result.fileID,
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
    const { fileID } = this.data;
    if (!fileID) return;

    wx.showLoading({ title: '下载中' });
    wx.cloud.downloadFile({ fileID })
      .then(res => {
        const fs = wx.getFileSystemManager();
        const savedPath = `${wx.env.USER_DATA_PATH}/ledger_export_${Date.now()}.xls`;
        fs.saveFile({
          tempFilePath: res.tempFilePath,
          filePath: savedPath,
          success: () => {
            wx.hideLoading();
            wx.openDocument({
              filePath: savedPath,
              fileType: 'xls',
              showMenu: true,
              success: () => wx.showToast({ title: '打开成功，点击右上角可保存到手机', icon: 'success' }),
              fail: (err) => {
                console.error('打开文档失败', err);
                wx.showToast({ title: '无法打开文件', icon: 'none' });
              }
            });
          },
          fail: (err) => {
            wx.hideLoading();
            console.error('保存文件失败', err);
            wx.showToast({ title: '保存文件失败', icon: 'none' });
          }
        });
      })
      .catch(err => {
        wx.hideLoading();
        console.error('下载失败', err);
        wx.showToast({ title: '下载失败', icon: 'none' });
      });
  }
});
