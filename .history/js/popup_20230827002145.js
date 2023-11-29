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
    var instanceUrl = tab.url.split('.')[0] + '.my.salesforce.com'
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
            version: '50.0',
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

async function processQuery(query) {
  records = [];
  processedQueries = [];
  try {
    var match = query.match(/\(([^)]+)\)/i)
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
        await executeQueryToDatabase(modifiedQuery);
      }
      console.log('final records length ' + records.length);
      console.log('records stingify ' + JSON.stringify(records));
      //return processedQueries;
      //executeQueryToDatabase(query);
    } else {
      executeQueryToDatabase(query)
    }
  } catch (error) {
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
      let { attributes, ...rec } = record;
      records.push(rec);
      // console.log('records output' + records)
    })
    .on('end', function () {
      console.log('@@ total in database : ' + query.totalSize)
      console.log('@@ total fetched : ' + query.totalFetched)
    })
    .on('error', function (err) {
      alert('ERROR NAME: ' + err.name)
      console.error(err)
    })
    .run({ autoFetch: true, maxFetch: 100000 })
}


document.querySelector('#downloadExcel').addEventListener('click', function() {
  console.log('clicked button excel');
  const exportButton = document.getElementById('downloadExcel');
  console.log('exportButton  ' + exportButton);
  console.log('XLSX' + XLSX);
    const ws = XLSX.utils.json_to_sheet(records);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

    const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'blob' })], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    
    a.download = 'exported_data.xlsx';
    a.click();

    // Clean up
    setTimeout(function() {
      URL.revokeObjectURL(url);
    }, 0);
 


});
