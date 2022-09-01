function onConnect() {
  console.log('All parties connected!');
  
}

function extract_share(share){

  return jiffClient.open(share)
}

// Returns sum of vote values from different parties
async function sumVote(input){
  const sums = [];
  for (var i =0; i<input[1].length; i++){
    var ithOptionResult = await input[1][i].sadd(input[2][i]).sadd(input[3][i]) // Todo: Change # of party dynamic
    var curr_sum = await extract_share(ithOptionResult);
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
    
   let res = await extract_share(ithOptionResult);
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

function test (sums, averages, std){
  console.log('');
  console.log('/////   Test Result  /////');
  console.log('');
  console.log([ 32, 16, 26, 24 ] , 'vs output:', sums)
  console.log([ 10.666666666666666, 5.333333333333333, 8.666666666666666, 8 ] , 'vs output:', averages)
  console.log([ 5.734883511361751, 2.8674417556808756, 6.649979114420002, 8.524474568362947 ] , 'vs output:', std)

  getLRFormula()
}

// Worker code to run all sum, ave, and std methods as well as test code
async function beer_Vote(inputs){

  const party=process.argv[2];
  const input= await jiffClient.share_array(inputs[party]);
  const n_party= jiffClient.party_count; 
  const beers = ['IPA', 'Large', 'Stuot', 'Pilsner'];
 
  console.log('beers', beers);
  console.log('');

  const sums = await sumVote(input);
  console.log('sum', sums);
  const averages = await aveVote(sums, n_party);
  console.log('averages', averages);
  const std =  await stdVote(input, averages, n_party)
  console.log('standard deviation', std);
  test(sums, averages, std);
}


// const { sdiv } = require('../../web-mpc/jiff/lib/client/protocols/bits/arithmetic.js');
// const JIFFClient = require('../../web-mpc/jiff/lib/jiff-client.js');
// const options = { party_count: 3, crypto_provider: true, onConnect: onConnect };
// const jiffClient = new JIFFClient('http://localhost:8112', 'our-setup-application', options);

// const inputs = {1:[10,5,3,1], 2:[18,2,5,3], 3:[4,9,18,20]};
// jiffClient.wait_for([1,2,3], ()=>beer_Vote(inputs));

class LinearRegression{
  constructor(x, y){
    this.X_input=x;
    this.Y_input=y;
    this.n_party=4;
    this.sumX = this.sumAll(x);
    this.sumY = this.sumAll(y);
    this.sumProdXY= this.multiplySum(x, y);
    this.sumPowX= this.powerSum(x);
    this.sumPowY= this.powerSum(x);
    this.intercept= this.getIntercept();    
    this.denominator;
    this.slope= this.getSlope();
  };

  sumAll(input){
    return input.reduce((a, b) => a + b, 0);
  };
  multiplySum(X_input,Y_input){
    console.log('hello world mult');
    var res=0;
    for(let i=0; i<X_input.length;i++){
      res+=X_input[i]*Y_input[i]
    }
    return res;
  };
  powerSum(input){
    var sqr = [];
    var p = 2;
    for (let i = 0; i < input.length; i++) {    
        sqr.push(Math.pow(input[i],p));    
    }
    console.log(this.sumAll(sqr));
    return this.sumAll(sqr);
  };
  
  getIntercept(){
    var numerator = this.sumY*this.sumPowX - this.sumX*this.sumProdXY;
    this.denominator = this.n_party*this.sumPowX-this.sumX*this.sumX;
    return numerator/this.denominator;
  }

  getSlope(){
    var numerator = this.n_party*this.sumProdXY - this.sumX*this.sumY;
    return numerator/this.denominator;
  };
  
  getLRFormula(){
    console.log('slope: ', this.slope, ' intercept: ', this.intercept)
  }

}

const X_input = [1,2,3,4]
const Y_input = [3,5,7,9]

lr = new LinearRegression(X_input,Y_input);
lr.getLRFormula();


//Refactor
// 1) Replace Promise to async+await for the code to be readable
// 2) Make common parameters global
// 2-sub) Change data structure of Share to share_array
