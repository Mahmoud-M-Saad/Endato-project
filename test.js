
async function testTimer(){
  // i=0;
  // while(true){

  //   await new Promise((resolve) => setTimeout(resolve, 10000)); // Add a delay of 300ms
  //   console.log("📢  " , i)
  //   if (i==10) {
  //     console.log("📢 out ")
  //     break;
  //   }

  //   i++

  // }

  for(let i=0 ; i<10 ; i++)
  {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Add a delay of 300ms

    console.log("xx" , i)
  }

}

testTimer()