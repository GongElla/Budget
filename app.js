App({
  globalData: {
    userInfo: null,
    recordMode: 'detailed',
    familyInfo: null
  },

  onLaunch() {
    wx.cloud.init({
      env: 'cloudbase-d1gi41lf7db8fc30f',
      traceUser: true
    });
    this.loginPromise = this.checkLogin();
  },

  checkLogin() {
    return wx.cloud.callFunction({ name: 'login' })
      .then(res => {
        const user = res.result.user;
        if (user) {
          this.globalData.userInfo = user;
          this.globalData.recordMode = user.recordMode || 'detailed';
        }
        return res;
      })
      .catch(err => {
        console.error('登录失败', err);
        wx.showModal({
          title: '登录失败',
          content: '网络异常，请检查网络后重试',
          showCancel: false
        });
        throw err;
      });
  }
});
