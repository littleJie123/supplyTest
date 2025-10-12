import { ArrayUtil } from "testflow";
import ICntAndPrice from "../inf/ICntAndPrice";
import Fraction from "./Fraction";

export default class {
  /**
   * 检查结果和值对不对
   * @param content 
   * @param cntAndPrices 
   * @param map 
   * @param cntCol 
   * @param targetCol 
   */
  static checkCntAndPrice(content: any[], cntAndPrices: any[], map: any,cntCol:string,targetCol?:string) {
    if(cntCol == null){
      cntCol = 'purcharse'
    }
    if(targetCol == null){
      targetCol = cntCol
    }
    let self = this;
    let myCnts = this.buildCntAndPrice(content,targetCol,'linkPrice');
    ArrayUtil.join({
      list: myCnts,
      list2: cntAndPrices,
      key: 'noteItemId',
      key2: 'linkNoteItemId',
      fun(row, row2) {
        self.doCheckCntAndPrice(row, row2, map)
      }
    })
  }

  private static doCheckCntAndPrice(row: ICntAndPrice, row2: ICntAndPrice, map) {
    let fee = map[row.name];
    let msg = `价格或者数量不对.${JSON.stringify(row)}| ${JSON.stringify(row2)}`
    if (fee == null) {
      if (this.notEq(row.cnt , row2.cnt) || this.notEq(row.price , row2.price)) {
        throw new Error(msg)
      }
    } else {
      let fraction = new Fraction(1, fee)
      if (this.notEq(fraction.cal(row.cnt) , row2.cnt) || this.notEq(row.price , fraction.cal(row2.price))) {
        throw new Error(msg)
      }
    }
  }

  static notEq(num1:number,num2:number){
    return Math.abs(num1-num2)>0.000001
  }

  /**
   * 创建出价格和数量
   * @param content 
   * @param cntCol 
   * @returns 
   */
  static buildCntAndPrice(content: any[],cntCol:string,priceCol?:string): ICntAndPrice[] {
    let retList: ICntAndPrice[] = []
    for (let row of content) {
      retList.push(this.doBuildCntAndPrice(row,cntCol,priceCol))
    }
    return retList;
  }

  /**
   * 转化成标准单位的价格和数量
   * @param row 
   * @param cntCol 
   * @param priceCol 
   * @returns 
   */
  private static doBuildCntAndPrice(row,cntCol:string,priceCol:string): ICntAndPrice {
    let cntObj = row[cntCol ?? 'purcharse'];
    let priceObj = row;
    if(priceCol != null && row[priceCol]!=null){
      priceObj = row[priceCol]
    }
    let priceValue = priceObj.price;
    let stockBuyUnitFee = row.stockBuyUnitFee ?? row.buyUnitFee;

    let cnt = new Fraction(cntObj.buyUnitFee, 1).cal(cntObj.cnt);
    let price = new Fraction(1, stockBuyUnitFee).cal(priceValue)
    return {
      name: row.name,
      cnt,
      price,
      noteItemId: row.noteItemId,
      linkNoteItemId: row.linkNoteItemId
    }
  }
  static change(noteItems: any[]) {
    let retList: any[] = [];
    for (let item of noteItems) {

      retList.push(this.changeOne(item));
    }
    return retList;
  }

  static changeOne(item: any) {
    let ret: any = {
      noteItemId: item.noteItemId
    }
    this.doChangeNoteItem(item, ret, 'purcharse', 'cnt');
    this.doChangeNoteItem(item, ret, 'instock', 'instockCnt');
    this.doChangeNoteItem(item, ret, 'sendCnt');
    if (item.supplierMaterial) {
      ret.price = item.supplierMaterial.price;
      ret.stockBuyUnitFee = item.supplierMaterial.buyUnitFee

    }
    ret.materialId = item.materialId;
    return ret;
  }

  protected static doChangeNoteItem(item: any, ret: any, srcCol: string, targetCol?: string) {
    let src = item[srcCol];
    if (src != null) {


      if (targetCol == null) {
        targetCol = srcCol;
      }
      ret[targetCol] = src.cnt;
    }
  }
}