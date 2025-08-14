/**
 *  分数
 * 【该类的作用是把各种unitFee转成分数并计算】
 * 
 */
 
export default class Fraction{
  /**
   * 分子
   */
  private  numerator:number = 1;
  private  denominator:number = 1; 

  /**
   * 根据unitfee产生分数
   * @param unitFeeOfNumerator 分子的unitfee，因为正值的unitfee表示的是一个分数，所以会在分母 ，负值才会在分子
   * @param unitFeeOfDenominator 分母的unitfee，因为正值的unitfee表示的是一个分数，所以会在分子 ，负值才会在分母
   */
  constructor(unitFeeOfNumerator:number,unitFeeOfDenominator:number){
    if(unitFeeOfNumerator>0){
      this.denominator *= unitFeeOfNumerator
    }else{
      this.numerator *= Math.abs(unitFeeOfNumerator)
    }

    if(unitFeeOfDenominator>0){
      this.numerator *= unitFeeOfDenominator
    }else{
      this.denominator *= Math.abs(unitFeeOfDenominator)
    }
  }

  cal(value:number){
    if(this.denominator == 0){
      this.denominator  = 1; //按道理不应该为0，加个防御性编程
    }
    value *= this.numerator;
    return  value / this.denominator 
  }
}