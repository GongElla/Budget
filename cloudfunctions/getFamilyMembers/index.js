const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { members } = event;
  if (!members || members.length === 0) {
    return { members: [] };
  }

  try {
    const usersRes = await db.collection('users')
      .where({ _openid: _.in(members) })
      .get();
    return { members: usersRes.data };
  } catch (err) {
    console.error('查询成员失败', err);
    return { members: [] };
  }
};
