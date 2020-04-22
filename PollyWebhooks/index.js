module.exports = async function (context, req) {
  context.log(JSON.stringify({context}));
  context.log(JSON.stringify({req}));

  context.res = {
    body: JSON.stringify({context, req})
  };
}
