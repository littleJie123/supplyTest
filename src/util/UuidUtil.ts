let cnt = 0;
export default class{
  static get():string{
    let date = new Date()
    return `${date.getTime()}|${cnt ++ }`
  }
}