console.log('background js loaded');
chrome.runtime.onConnect.addListener(function (port) {
    console.log('inside onconnect');
    port.onMessage.addListener(async function (msg) {
        console.log(msg.host);
        var listOfCookies = await chrome.cookies.getAll({ domain: msg.host });
        console.log('listofCoolies background js' + listOfCookies.length);
        if(listOfCookies.length == 0){
            listOfCookies = await chrome.cookies.getAll({ domain: msg.host.replace('my.salesforce', 'sandbox.my.salesforce') });
        }
        var session = null;
        for (let i = 0; i < listOfCookies.length; i++) {
            console.log('inside loop background js')
            if (listOfCookies[i].name == "sid") {
                console.log('session', listOfCookies[i].value);
                session = listOfCookies[i].value;
                break;
            }
        }
        port.postMessage({ ssid: session });
    });
});