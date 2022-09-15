
function onConnect() {
    console.log('All parties connected!');
    
  }
  
  // Returns sum of vote values from different parties
  async function sumVote(input){
    const sums = [];
    for (var i =0; i<input[1].length; i++){
      var ithOptionResult = await input[1][i].sadd(input[2][i]).sadd(input[3][i]) // Todo: Change # of party dynamic
      var curr_sum = await ithOptionResult.open();
      sums.push(curr_sum);
    }
    return sums;
  }
  
  // Returns Average of vote values from different parties, using the pre computed sums(Array of sum of vote for each beer) as input
  async function aveVote(sums, n_party){
    const averages=[]
    for(var i=0; i<sums.length;i++){
      var cur_ave = await sums[i]/n_party;
      averages.push(cur_ave);
    }
    return averages;
  }
  
  // Returns Standard Deviation of vote values from different parties (E[x^2] - E[x]^2)
  async function stdVote(input, averages, n_party){
    // Calculate average of squared inputs for each beer
    let aveOfSqrt = [];
    for (var i =0; i<input[1].length; i++){
      var ithOptionResult = input[1][i].cpow(2).sadd(input[2][i].cpow(2)).sadd(input[3][i].cpow(2)); // Sum powered input from all parties
      
     let res = await ithOptionResult.open();
     aveOfSqrt.push(res/n_party); 
    }
    const std =[];
    // Calculate standard deviation of squared inputs for each beer
    for (var i =0; i<aveOfSqrt.length; i++){
      var sd = Math.sqrt(aveOfSqrt[i]-averages[i]**2);
      std.push(sd);
    }
    return std;
  }
  
  // Sum X/Y values from all parties
  async function sum_AllShare(input, n_party, idx){
      try{
        if(input.length<2) throw "empty";
      }
      catch(err) {
        console.log("Input has to have 2 or more elements");
      }
  
      var res_share=input[1][idx];
      for (var i =2; i<=n_party; i++){
        res_share = await res_share.sadd(input[i][idx]);
      }
    var res = await res_share.open();
    return res;
  };
  
  // Sum all elements(share) in an array
  async function sum_Array(arr_input){
    try{
      if(arr_input.length==0) throw "empty";
    }
    catch(err) {
      console.log("Input array is empty");
    }
  
    var res_share=arr_input[0];
  
    for (var i=1;i<arr_input.length;i++){
      res_share=await res_share.sadd(arr_input[i])
    }
    var res = await res_share.open();
    return res
  }
  
  // Sum multiplied value of X and Y from all parties
  async function multiplySum(input, n_party, idx1, idx2){
    var mul_arr=[];
    for (let i =1; i<=n_party; i++){
      const x1 = await input[i][idx1];
      const x2 = await  input[i][idx2];
      const curr_sum = await x1.smult(x2);
      // const curr_sum_opened  = await curr_sum.open()
      // console.log('output from ', i ,'-', await curr_sum_opened.toString(10))
      mul_arr.push(curr_sum);
    }
  
    const res = await sum_Array(mul_arr);
    return res;
  };
  
  // Sum powered value of X/Y
  async function powerSum(input, n_party, idx){
    var sqr = [];
    for (let i = 1; i <=n_party; i++) {
      const curr_res = await input[i][idx].smult(input[i][idx]);
      sqr.push(curr_res);    
    }
    const res = await sum_Array(sqr);
    return res;
  };
  
  // Sum variance
  async function varSum(powsum, sum1, sum2, n_party){
    return powsum-(sum1*sum2)/n_party;
  };
  
  async function getIntercept(sumX, sumY, sumPowX, sumProdXY, n_party){
    var numerator = sumY*sumPowX - sumX*sumProdXY;
    var denominator = n_party*sumPowX-sumX*sumX;
    return numerator/denominator;
  }
  
  async function getSlope(sumX, sumY, sumPowX, sumProdXY , n_party){
    var numerator = n_party*sumProdXY - sumX*sumY;
    var denominator = n_party*sumPowX-sumX*sumX;
    return numerator/denominator;
  };
  
  class SimpleLinearRegression{
    constructor(){
      this.intercept= 0;
      this.slope= 0;
      this.n_party=0
    };

    async buildModel(inputs, idx1, idx2, jiffClient, anova){
      const party=process.argv[2];
      const input= await jiffClient.share_array(inputs[party]);
      this.n_party= jiffClient.party_count;

      const sumX = await sum_AllShare(input,this.n_party, idx1);
      console.log('sumX', sumX.toString(10), '== 6');
      const sumY = await sum_AllShare(input,this.n_party, idx2);
      console.log('sumY', sumY.toString(10), '== 12');
      const sumProd = await multiplySum(input, this.n_party, idx1, idx2);
      console.log('sumProd', sumProd.toString(10), '== 28');
      const sumPowX= await powerSum(input,this.n_party, 0);
      console.log('sumPow', sumPowX.toString(10), '== 14');
      const sumPowY= await powerSum(input, this.n_party, 1);
      console.log('sumPow', sumPowY.toString(10), '== 56');
      
      this.intercept= await getIntercept(sumX, sumY, sumPowX, sumProd, this.n_party);
      console.log('intercept', this.intercept.toString(10), '== 0');
      this.slope= await getSlope(sumX, sumY, sumPowX, sumProd, this.n_party);  
      console.log('slope', this.slope.toString(10), '== 2');
      
      const xVal_share = 1;
      this.predict(xVal_share)

      if(anova==true){ // Todo: Make F-Test accept one or two X variables
        this.run_Ftest(input, idx1, idx2)
      }
    }
    predict(xVal){
      console.log('slope: ', this.slope, ' intercept: ', this.intercept)
      console.log('Y = ', this.slope, '* x + ', this.intercept)
      var res = xVal*this.slope+this.intercept;
      console.log('Predicted value: ', res)
    }
    
    async run_Ftest(input, idx1, idx2, idx3){
      const reg_df=1;
      const res_df=this.n_party-reg_df-1;
      const anova_analysis= new ANOVA(this, reg_df, res_df)
      const F_test = await anova_analysis.computeF_statistic(input, idx1, idx2, idx3, this.n_party);
    }
  }
  
  class MultipleLinearRegression{

    constructor(){
      this.intercept=-6.867;
      this.slope1=3.148;
      this.slope2=-1.656;
      this.n_party=8;
    };
    
    async buildModel(inputs, idx1, idx2, idx3, jiffClient, anova){
        const party=process.argv[2];
        const input= await jiffClient.share_array(inputs[party]);
        // this.n_party= jiffClient.party_count;
    
        // const sumX1 = await sum_AllShare(input,this.n_party, idx1);
        // console.log('sumX1', sumX1.toString(10), '== 555');
        // const sumPowX1= await powerSum(input, this.n_party, idx1);
        // console.log('sumPow1', sumPowX1.toString(10), '== 38767');
        // const varX1= await varSum(sumPowX1, sumX1, sumX1, this.n_party);
        // console.log('varX1', varX1.toString(10), '== 263.875');
          
        // const sumX2 = await sum_AllShare(input,this.n_party, idx2);
        // console.log('sumX2', sumX2.toString(10), '== 145');
        // const sumPowX2= await powerSum(input, this.n_party, idx2);
        // console.log('sumPow2', sumPowX2.toString(10), '== 2823');
        // const varX2= await varSum(sumPowX2, sumX2, sumX2, this.n_party);
        // console.log('varX2', varX2.toString(10), '== 194.875');
      
        // const sumY = await sum_AllShare(input,this.n_party, idx3);
        // console.log('sumY', sumY.toString(10), '== 1452');
      
        // const sumProdX1Y = await multiplySum(input, this.n_party, idx1, idx3);
        // console.log('sumProdX1Y', sumProdX1Y.toString(10), '== 101895');
        // const varX1Y= await varSum(sumProdX1Y, sumX1, sumY, this.n_party);
        // console.log('varX1Y', varX1Y.toString(10), '== 1162.5');
      
        // const sumProdX2Y = await multiplySum(input, this.n_party, idx2, idx3);
        // console.log('sumProdX2Y', sumProdX2Y.toString(10), '== 25364');
        // const varX2Y= await varSum(sumProdX2Y, sumX2, sumY, this.n_party);
        // console.log('varX2Y', varX2Y.toString(10), '== -953.5');
        
        // const sumProdX1X2 = await multiplySum(input, this.n_party, idx1, idx2);
        // console.log('sumProdX1X2', sumProdX1X2.toString(10), '== 9859');
        // const varX1X2= await varSum(sumProdX1X2, sumX1, sumX2, this.n_party);
        // console.log('varX1X2', varX1X2.toString(10), '== -200.375');
      
        // this.slope1=await this.getSlope(varX1, varX2, varX1Y, varX2Y, varX1X2);
        // this.slope2=await this.getSlope(varX2, varX1, varX2Y, varX1Y, varX1X2);
        // this.intercept= await this.getIntercept(sumX1, sumX2, sumY, this.slope1, this.slope2, this.n_party);

        // this.slope1=new BigNumber((await this.getSlope(varX1, varX2, varX1Y, varX2Y, varX1X2)).toFixed(5));
        // this.slope2=new BigNumber((await this.getSlope(varX2, varX1, varX2Y, varX1Y, varX1X2)).toFixed(5));
        // this.intercept= new BigNumber((await this.getIntercept(sumX1, sumX2, sumY, this.slope1, this.slope2, this.n_party)).toFixed(5));

        console.log('slope1', this.slope1, '== 3.148');
        console.log('slope2', this.slope2, '== -1.656');
        console.log('intercept', this.intercept, '==  -6.867');
        
        if(anova==true){
          this.run_Ftest(input, idx1, idx2, idx3)
        }
    }
  
    async getSlope(varObj, varOther, varProdObjxY, varProdOtherxY, varProdObjOther){
      var numerator = varOther*varProdObjxY - varProdObjOther*varProdOtherxY;
      var denominator = varObj*varOther-varProdObjOther*varProdObjOther;
      return numerator/denominator;
    };
    
    async getIntercept(sumX1, sumX2, sumY, slope1, slope2, n_party){
      var intercept= (sumY-sumX1*slope1-sumX2*slope2)/n_party;
      return intercept;
    }

    async predict(x1, x2){
      
      const first = await x1.cmult(this.slope1);
      const first_opened= await first.open()
      const x1_opened= await x1.open()
      
      const second = await x2.cmult(this.slope2);
      const second_opened= await second.open()
      const x2_opened= await x2.open()
      
      // console.log('x1', x1_opened.toString(), 'x2', x2_opened.toString())
      console.log('x1', x1_opened.toString(), 'x2', x2_opened.toString())
      console.log('first', first_opened.toString(), 'second', second_opened.toString(), 'intercept', this.intercept);
      
      var res = await first.sadd(second);
      res = await res.cadd(this.intercept);
      const res_opened = await res.open()
      console.log('predicted value: ', res_opened.toString())
      return res;
    }
  
    async run_Ftest(input, idx1, idx2, idx3){
      const reg_df=2;
      const res_df=this.n_party-reg_df-1;
      const anova_analysis= new ANOVA(this, reg_df, res_df)
      const F_test = await anova_analysis.computeF_statistic(input, idx1, idx2, idx3, this.n_party);
    }
  }
   
  
  class ANOVA{
    constructor(model, reg_df, res_df){
      this.reg=0;
      this.reg_df=reg_df;
      this.res=0;
      this.res_df=res_df;
      this. y_ave=0;
      this.model=model;
    }
    async computeRegMS(pred){
      const interim = await pred.csub(this.y_ave);
      const regSS =  await interim.smult(interim);
      return regSS;
    }
    async computeResMS(input,pred){
      const interim = await input.sub(pred);
      const resSS = await interim.smult(interim);
      return resSS;
    }
    async computeF_statistic(input, x1_idx, x2_idx, y_idx, n_party){
      this.y_ave=await sum_AllShare(input, n_party, y_idx)/n_party;
      var pred = await this.model.predict(input[1][x1_idx], input[1][x2_idx]);

      var regSS = await this.computeRegMS(pred);
      // var regSS_open = await regSS.open();
      // console.log('regSS 1: ', regSS_open.toString())
      var resSS = await this.computeResMS(input[1][y_idx],pred)
      // var resSS_open =  await resSS.open();
      // console.log('resSS 1: ', resSS_open.toString())

       for(let i=2; i<=n_party;i++){
          pred = await this.model.predict(input[i][x1_idx], input[i][x2_idx]);
          const curr_regSS = await this.computeRegMS(pred);
          regSS = await regSS.sadd(curr_regSS);
          const curr_resSS = await this.computeResMS(input[i][y_idx], pred);
          resSS = await resSS.sadd(curr_resSS);
       }
      
      regSS=await regSS.open()
      const regMS=regSS/this.reg_df;
      console.log('MeanSquare regression', regMS, '=2619.279169');
      
      resSS=await resSS.open()
      const resMS=resSS/this.res_df;
      console.log('MeanSquare residual', resMS, '= 40.6883322');
      const F_statistic=regMS/resMS
      console.log('F-statistic: ', F_statistic, '= 64.37420819');
      const r2 = regSS.dividedBy(regSS.plus(resSS));
      console.log('R2: ', r2.toString());

      if(F_statistic>5.7861){
        console.log('At 95% of likelihood, the result is significant')
      }
      else{
        console.log('At 95% of probability, the result is not significant')
      }
      return F_statistic;
    }
  }

  const modelType = process.argv[3];
  const JIFFClient = require('../../web-mpc/jiff/lib/jiff-client.js');
  var BigNumber = require('../../web-mpc/jiff/node_modules/bignumber.js/bignumber.js');
  
  const jiff_bignumber = require('../../web-mpc/jiff/lib/ext/jiff-client-bignumber');
  const jiff_fixedpoint = require('../../web-mpc/jiff/lib/ext/jiff-client-fixedpoint');
  const jiff_negativenumber = require('../../web-mpc/jiff/lib/ext/jiff-client-negativenumber');
  
  // const options = { party_count: 1, crypto_provider: true, onConnect: onConnect , decimal_digits:5, integer_digits:5, Zp:562949948117};
  const options = { party_count: 1, crypto_provider: true, onConnect: onConnect , Zp:562949948117};
  const jiffClient = new JIFFClient('http://localhost:8112', 'our-setup-application', options);
  jiffClient.apply_extension(jiff_bignumber, options);
  jiffClient.apply_extension(jiff_fixedpoint, options);
  jiffClient.apply_extension(jiff_negativenumber, options);


  if(modelType==0){ ///Multiple Linear Regression Model
    jiffClient.party_count=8;
    const inputs = {1:[60,22,140], 2:[62,25,155], 3:[67,24,159], 4:[70,20,179], 5:[71,15,192], 6:[72,14,200], 7:[75,14,212], 8:[78,11,215]};
    
    jiffClient.wait_for([1,2,3,4,5,6,7,8], ()=>{
      const idx1 = 0
      const idx2 = 1
      const idx3 = 2

      const LR_model = new MultipleLinearRegression();
      LR_model.buildModel(inputs, idx1, idx2, idx3, jiffClient, true);
    })
  } else if(modelType==1){ ///Simple Linear Regression Model
    jiffClient.party_count=3;
    const inputs_SLR = {1:[1,2], 2:[2,4], 3:[3,6]};
    jiffClient.wait_for([1,2,3], ()=>{
      LR_model = new SimpleLinearRegression();
      LR_model.buildModel(inputs, 0, 1, jiffClient, false)
    })
  } else if(modelType==2){ ///Temporary Experiment

    jiffClient.party_count=2;
    for(let x=60; x<61 ;x++){
      const inputs={1:60,2:x};
      jiffClient.wait_for([1,2], ()=>temp_runner(inputs, jiffClient));
    }
  }
  else if(modelType==3){ ///Voting Method
    const options = { party_count: 3, crypto_provider: true, onConnect: onConnect };
    const jiffClient = new JIFFClient('http://localhost:8112', 'our-setup-application', options);
    
    const inputs = {1:[10,5,3,1], 2:[18,2,5,3], 3:[4,9,18,20]};
    jiffClient.wait_for([1,2,3], ()=>beer_Vote(inputs, jiffClient));
    
  }


  async function temp_runner(inputs, jiffC){
    const party=process.argv[2];
    const input= await jiffC.share(inputs[party]);
    
    const curr_sum = await input[1].smult(input[2]);

    const x1 = await input[1].open();
    const x2 = await  input[2].open();
    const curr_sum_opened  = await curr_sum.open()
    console.log('input -', x1.toString(10), x2.toString(10))
    console.log('output -', curr_sum_opened.toString(10))

  }
    // Worker code to run all sum, ave, and std methods as well as test code
    async function beer_Vote(inputs, jiffClient){
  
      const party=process.argv[2];
      const input= await jiffClient.share_array(inputs[party]);
      const n_party= jiffClient.party_count; 
      const beers = ['IPA', 'Large', 'Stuot', 'Pilsner'];
     
      console.log('beers', beers);
      console.log('');
    
      const sums = await sumVote(input);
      console.log('sum', sums, '=[ 32, 16, 26, 24 ]');
      const averages = await aveVote(sums, n_party);
      console.log('averages', averages, '=[ 10.666666666666666, 5.333333333333333, 8.666666666666666, 8 ] ');
      const std =  await stdVote(input, averages, n_party)
      console.log('standard deviation', std, '=[ 5.734883511361751, 2.8674417556808756, 6.649979114420002, 8.524474568362947 ]');
    }
    
  
