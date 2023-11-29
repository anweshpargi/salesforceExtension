//store connection... con object
var conn = undefined;
var inputQuery = undefined;

console.log('popup js loaded succesfully')
document.querySelector('#getbutton').addEventListener('click', () => {
  console.log('XLSX ' + XLSX);
  console.log('method invoked on button click')
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    console.log('inside tabs query')
    var tab = tabs[0]
    console.log(tab.url.split('.')[0]);
    var instanceUrl = undefined
    if(tab?.url != undefined && tab.url.includes('sandbox')){
      console.log('Success if condition includes sandbox');
       instanceUrl = tab.url.split('.')[0] + '.sandbox.my.salesforce.com'
    }else{
      instanceUrl = tab.url.split('.')[0] + '.my.salesforce.com'
    }
    console.log(tab)
    var domainUrl = new URL(tab.url)
    var sessionId = undefined
    if (
      tab.url &&
      (tab.url.includes('.lightning.force.com') ||
        tab.url.includes('.salesforce.com'))
    ) {
      var port = chrome.runtime.connect({ name: 'knockknock' })
      port.postMessage({ host: instanceUrl.replace('https://', '') })
      port.onMessage.addListener(function (msg) {
        console.log('response from backgroundjs' + msg.ssid)
        sessionId = msg.ssid
        if (sessionId) {
          console.log('session id received  ', sessionId)
          conn = new jsforce.Connection({
            serverUrl: instanceUrl,
            instanceUrl: instanceUrl,
            sessionId: sessionId,
            version: '58.0',
          }) //jsforce
          console.log('connection', conn)
          getQueryInput()
        } else {
          alert('Salesforce Session Not found')
        }
      })
    } else {
      alert(
        'Not a Salesforce Domain!, Keep Salesforce Tab Active and Run again',
      )
    }
  })
})

function getQueryInput() {
  try {
    if (conn) {
      inputQuery = document
        .querySelector('#floatingtextarea')
        .value.replace(/\s\s+/g, ' ')
        .trim()
      console.log('Input query by user >> ' + inputQuery)
      processQuery(inputQuery);
    } else {
      alert('Connection not available')
    }
  } catch (error) {
    alert('Something went wrong ' + error.name)
  }
}

var records = [];
var processedQueries = [];
var recordCount = 0;
var countElement = undefined;
var statusElement = undefined;
var doCancel = false;

async function processQuery(query) {
  doCancel = false;
  countElement = document.getElementById('count');
  statusElement = document.getElementById('status');
  statusElement.style.display = "none";
  console.log('@@@ elementcount ' + countElement);
  recordCount = 0;
  records = [];
  processedQueries = [];
  try {
    isDisableExecute(true);
    showDownloadExcel(false);
    showSpinner(true);
    var match = query.match(/\(([^)]+)\)/i);
    if (match && query.length > 4000) {
      console.log('match and lenght pass');
      var valuesString = match[1];
      console.log('valuesString>> ' + valuesString);
      var valuesList = valuesString.split(',');

      var batchSize = 100;

      for (let i = 0; i < valuesList.length; i += batchSize) {
        // Slice a batch of values
        var batch = valuesList.slice(i, i + batchSize);
        // Join batch values with commas to create a new values string
        var batchValuesString = batch.join(',');

        // Replace values within parentheses with the batch values
        var modifiedQuery = query.replace(valuesString, batchValuesString);
        //console.log('modifiedQurery  >>' + modifiedQuery);
        // Store the modified query in the processedQueries array
        processedQueries.push(modifiedQuery);
        console.log('count ' + i);
        showSpinner(true);
        await executeQueryToDatabase(modifiedQuery);
      }
      console.log('final records length ' + records.length);
      console.log('records stingify ' + JSON.stringify(records));
      showSpinner(false);
     
      isDisableExecute(false);
      //return processedQueries;
      //executeQueryToDatabase(query);
    } else {
      executeQueryToDatabase(query);
      //showSpinner(false);
      //showDownloadExcel(true);
      //isDisableExecute(false);
    }
  } catch (error) {
    showSpinner(false);
    isDisableExecute(false);
    showDownloadExcel(false);
    alert(error.name)
    console.log(error)
  }
}

async function executeQueryToDatabase(inputQuery) {
  console.log('modified Query ' + inputQuery);
  
  var query = await conn
    .query(inputQuery)
    .on('record', function (record) {
      // console.log('@@ records push' + record.length)
      if(doCancel){
        return;
      }
      ++recordCount;
      console.log('@@@ ' + recordCount);
      //console.log('@@@@@ query.totalSize ' + query.totalSize);
      console.log('@@@@@@@ countElement '+ countElement.innerHTML);
      countElement.innerHTML = recordCount;
      let { attributes, ...rec } = record;
      records.push(rec);
      // console.log('records output' + records)
    })
    .on('end', function () {
      console.log('@@ total in database : ' + query.totalSize)
      console.log('@@ total fetched : ' + query.totalFetched)
      showSpinner(false);
      statusElement.style.display = "inline";
      statusElement.innerHTML = 'Success Total: ' + records.length;
      showDownloadExcel(true);
      isDisableExecute(false);

    })
    .on('error', function (err) {
      alert('ERROR NAME: ' + err.name)
      showDownloadExcel(false);
      showSpinner(false);
      isDisableExecute(false);
      showDownloadExcel(false);
      console.error(err)
    })
    .run({ autoFetch: true, maxFetch: 1000000 })
}


document.querySelector('#downloadExcel').addEventListener('click', function() {
  console.log('clicked button excel');
  const exportButton = document.getElementById('downloadExcel');
  console.log('exportButton  ' + exportButton);
  console.log('XLSX' + XLSX);

  // const data = [
  //   { Name: 'John', Age: 30 },
  //   { Name: 'Jane', Age: 25 }
  // ];


  const ws = XLSX.utils.json_to_sheet(records);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  // Convert the workbook to an ArrayBuffer
  const wbArrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

  // Create a Blob from the ArrayBuffer
  const blob = new Blob([wbArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    const currentDatetime = new Date().toISOString().replace(/[-:.]/g, '');

    const encodedFileName = encodeURIComponent(`exported_data_${currentDatetime}.xlsx`);

    a.download = encodedFileName;
    a.click();

    // Clean up
    setTimeout(function() {
      URL.revokeObjectURL(url);
    }, 0);
    alert(`${encodedFileName} downloaded succefully`);
});

function showSpinner(isShow){
  if(isShow){
    console.log('isshowspinner true');
    document.getElementById('loader').style.display = "inline";
  }else{
    document.getElementById('loader').style.display = "none";
  }
}

function showDownloadExcel(isShow){
  if(isShow){
    document.getElementById('downloadExcel').style.display = "inline";
  }else{
    document.getElementById('downloadExcel').style.display = "none";
  }
}

function isDisableExecute(isDisable){
    document.getElementById('getbutton').disabled = isDisable;
}

document.getElementById('cancel').addEventListener('click', ()=>{
console.log('Cancle button executed');
doCancel = true;

})
