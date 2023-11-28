const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const fs = require('fs');
const axios = require('axios');
const cors = require('cors');
const util = require('util');
const multer = require('multer');

app.use(express.json());
app.use(cors());

let BusinessV2SearchIndexCounter = 0;
let ContactEnrichIndex = 0;

const uploadFile = multer({
  storage: multer.diskStorage({
    destination: "./",
    filename: (req, file, cb) => {
      cb(null, `${file.originalname}`)
    }
  })
});

//!📢 removeDuplicatesAndFilter_ByState => this one for filtering and reduce companies data and used as getting data from excel
//!👌 searchForOfficersData => this function which give me emails and numbers for each officer
//!👌 filterEmails_Phones => this function which used in 'searchForOfficersData' for filtering response
//!👌 filterOfficersData => this one sort officers final objects
//!📢 collect_officers_from_eachbusinessSearch => this one for getting final 5 officers
//!📢 step2final_SearchContact => this function take 'companyObjs' => search for business => filter 5 officers by 'collect_officers_from_eachbusinessSearch'
//!  => search for officers contacts with ID or names => filter and take 5 contacts for each officer

//const uniqueNamesRegex = /[^a-zA-Z0-9\s]+/g;
// const removeDublicatesCompanyNames = function (dataWithUniqueNames) {
//   const finalFilterdCompantData = [];
//   const uniqueCompanyNames = new Set();

//   for (const obj of dataWithUniqueNames) {
//     if (!uniqueCompanyNames.has(obj["Primary Name"])) {
//       uniqueCompanyNames.add(obj["Primary Name"]);
//       finalFilterdCompantData.push(obj);
//     }
//   }

//   return finalFilterdCompantData;
// }
function saveDataInFS(filePath, dataAsString) {
  fs.writeFile(filePath, dataAsString, (err) => {
    if (err) {
      console.error('Error writing JSON file:', err);
    } else {
      console.log('JSON file saved successfully as JSON.');
    }
  });

};

const uniqueNamesRegex = /[.,:;]/g;
const uniqueNames = function (inputText) {
  return inputText.replace(uniqueNamesRegex, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
};

const removeDuplicatesAndFilter_ByState = function (dataWithUniqueNames) {
  const finalFilteredCompanyData = [];
  const uniqueCompanyNames = new Set();

  for (const obj of dataWithUniqueNames) {
    //!uniqueCompanyNames.has(obj["Primary Name"]) && obj["State"] === "CA"
    if (true) {
      uniqueCompanyNames.add(obj["Primary Name"]);
      finalFilteredCompanyData.push(obj);
    }
  }
  // Create an object to group objects by Bureau Number
  const groupedData = finalFilteredCompanyData.reduce((result, item) => {
    const key = item['Bureau Number'];
    if (!result[key]) {
      result[key] = { 'Bureau Number': key, 'Primary Names': [], 'CopyPasteURLs': [], ...item };
    }
    result[key]['Primary Names'].push(item['Primary Name']);
    result[key]['CopyPasteURLs'].push(item['CopyPasteURL']);
    return result;
  }, {});

  // Convert the grouped object back to an array of objects
  const resultArray = Object.values(groupedData);

  // console.log(resultArray);

  return resultArray;
};

const filterOfficersData = function (data) {
  // filter steps =>  first remove doubliactes of addressHash , then sort to the netwest date of startDate , 
  //then remove doublicates of PersonID  , then remove doublicates of same names of  FirstName and LastName togther ,,, 
  //then sort the final result to make PersonID which have values at first then null values

  // Step 1: Remove empty objects
  const filteredData = data.filter(item => Object.keys(item).length > 0);

  const sortedResult = filteredData.sort((a, b) => {
    if (a.PersonID === null && b.PersonID !== null) {
      return 1;
    }
    if (a.PersonID !== null && b.PersonID === null) {
      return -1;
    }
    return 0;
  });
  //console.log("sortedResult" , sortedResult)
  const filteredResult = [];
  const uniqueFirstNames = {};
  for (const item of sortedResult) {
    // console.log(item.FirstName)
    let firstName = item.FirstName;
    let lastName = item.LastName;
    let personID = item.PersonID;
    // const personID = item.PersonID;
    let nameKey = `${firstName} ${lastName}`
    if (!uniqueFirstNames[nameKey]) {
      uniqueFirstNames[nameKey] = true;
      // console.log(uniqueFirstNames)
      filteredResult.push(item);
    }
  }

  return filteredResult;

};

const collect_officers_from_eachbusinessSearch = function (businessV2res) {
  //businessV2res => is my res.data
  //! here i collect only officers from each business searh
  let businessV2RecordsList = businessV2res.businessV2Records;
  let idsList_per_officer = [];
  if (businessV2RecordsList.length === 0) {
    console.log("😒", "empty response for business search")
    return []
  }
  for (let i = 0; i < businessV2RecordsList.length; i++) {

    let targetResObject = businessV2RecordsList[i];
    //usCorpFilings => is arrray which has officers , some times be empty
    let target_usCorpFilings_list = targetResObject.usCorpFilings
    for (let j = 0; j < target_usCorpFilings_list.length; j++) {
      if (target_usCorpFilings_list.length >= 1) {
        let temp_officers_list_per_usCorpFilings = target_usCorpFilings_list[j].officers
        //    console.log(temp_officers_list_per_usCorpFilings.length)
        if (temp_officers_list_per_usCorpFilings.length === 0) {
          console.log("😒", "there is no officers in this res")
          return
        }
        for (let x = 0; x < temp_officers_list_per_usCorpFilings.length; x++) {

          if (temp_officers_list_per_usCorpFilings.length >= 1) {
            let target_officer_object = temp_officers_list_per_usCorpFilings[x];
            //! for getting IDs
            if (target_officer_object?.name) {
              let tempObj = {
                "PersonID": target_officer_object?.name?.tahoeId,
                "FirstName": target_officer_object?.name?.nameFirst,
                "LastName": target_officer_object?.name?.nameLast,
                "Street": target_officer_object?.address?.addressLine1,
                "City": target_officer_object?.address?.city,
                "State": target_officer_object?.address?.state,
                "postalCode": target_officer_object?.address?.zip,
                "fullName": target_officer_object?.name?.nameRaw,
                "Addresses":
                {
                  "addressLine2": `${target_officer_object?.address?.city}, ${target_officer_object?.address?.state}`,
                },
                "addressHash": target_officer_object?.address?.addressHash,
                "startDate": target_officer_object?.startDate

              }
              idsList_per_officer.push(tempObj)

            }
          }
        }


      }
    }


  }
  //  return filterOfficersData(idsList_per_officer).slice(0, 5);
  return idsList_per_officer;

};
function collect_officers_from_NewResponse(newres) {
  let businessV2RecordsList = newres.businessV2Records;
  let officersList = []

  // console.log('businessV2RecordsList: ', businessV2RecordsList.newBusinessFilings);
  for (let i = 0; i < businessV2RecordsList.length; i++) {
    let newBusinessFilings = businessV2RecordsList[i].newBusinessFilings;
    for (let j = 0; j < newBusinessFilings.length; j++) {
      let contacts = newBusinessFilings[j].contacts
      let addresses = newBusinessFilings[j].addresses
      let tempOfficerObj = {};
      // console.log('addresses: ', addresses);
      //console.log('contacts: ', contacts);
      contacts
        .filter((item) => item.contactTypeDesc.includes('OFFICER'))
        .forEach((item) => {
          tempOfficerObj['PersonID'] = item.tahoeId;
          tempOfficerObj['FirstName'] = item.name.firstName;
          tempOfficerObj['LastName'] = item.name.lastName;
          tempOfficerObj['fullName'] = item.name.fullName;
          tempOfficerObj['contactTypeDesc'] = item.contactTypeDesc

        });

      addresses
        .filter((item) => item.addressTypeDesc.includes(tempOfficerObj['contactTypeDesc']))
        .forEach((item) => {
          tempOfficerObj['City'] = item.city;
          tempOfficerObj['State'] = item.state;
          tempOfficerObj['postalCode'] = item.zip;
          tempOfficerObj['Street'] = item.addressLine1;
          tempOfficerObj['addressTypeDesc'] = item.addressTypeDesc;
          tempOfficerObj['Addresses'] =
          {
            "addressLine2": `${item.city}, ${item.state}`,
          }

        });

      if (tempOfficerObj != {}) {
        //   console.log("not empty objjjjj")
        officersList.push(tempOfficerObj)
      }
      else {
        //  console.log(" empty objjjjj 📢📢")

      }

      //console.log('filteredData: ', tempOfficerObj);

    }

  }
  //  console.log('officersList: ', officersList);
  return officersList;

};

function filterEmails_Phones(data) {
  if (!data.person) {
    return {
      emails: [], phones: [], 'addresses': {
        "street": "",
        "city": "",
        "state": "",
        "zip": "",
      }
    };
  }
  // console.log(data.person.addresses);
  // console.log(
  //   "Before filter emails-length: " + data.person.emails.length + " & phones-length" +
  //   ": " + data.person.phones.length + " => 😒 "
  // );
  let NewData = {
    'phones': [],
    'emails': [],
    'addresses': {
      "street": "",
      "city": "",
      "state": "",
      "zip": "",
    }
  }
  for (let i = 0; i < data.person.emails.length; i++) {
    if (!(data.person.emails[i].isValidated)) {
      data.person.emails.splice(i, 1);
      i--;
    } else {
      NewData.emails.push(data.person.emails[i].email);
    }
  };
  for (let i = 0; i < data.person.phones.length; i++) {
    if (!(data.person.phones[i].isConnected)) {
      data.person.phones.splice(i, 1);
      i--;
    } else {
      data.person.phones[i].lastReportedDate = new Date(data.person.phones[i].lastReportedDate);
    }
  };
  data.person.phones.sort((a, b) => b.lastReportedDate - a.lastReportedDate);
  data.person.phones = data.person.phones.slice(0, 6);
  for (let i = 0; i < data.person.phones.length; i++) {
    NewData.phones.push(data.person.phones[i].number);
  }
  //==================Addresse=========================
  for (let i = 0; i < data.person.addresses.length; i++) {
    data.person.addresses[i].lastReportedDate = new Date(data.person.addresses[i].lastReportedDate);
  };
  //console.log(data.person.addresses);
  data.person.addresses.sort((a, b) => b.lastReportedDate - a.lastReportedDate);
  data.person.addresses = data.person.addresses.slice(0, 1);
  // console.log(data.person.addresses);
  for (let i = 0; i < data.person.addresses.length; i++) {
    NewData.addresses.street = data.person.addresses[i].street;
    NewData.addresses.city = data.person.addresses[i].city;
    NewData.addresses.state = data.person.addresses[i].state;
    NewData.addresses.zip = data.person.addresses[i].zip;
  }
  // console.log(
  //   "After filter emails-length: " + data.person.emails.length +
  //   " & phones-length: " + data.person.phones.length + " => 😊 "
  // );
  return NewData;
};

async function searchForConacts(officersListArr) {
  let officersList = officersListArr
  console.log("my obj befor contact search", officersList)
  for (let i = 0; i < officersList.length; i++) {

    setTimeout(async()=>{
      let targetOfficer = officersList[i];
      if (officersList[i]["PersonID"] !== null) {
        try {
          const response = await axios.request({
            method: 'POST',
            url: 'https://devapi.endato.com/Contact/Id',
            headers: {
              accept: 'application/json',
              'galaxy-ap-name': '12b8b798-8854-49ac-878c-48ac1d6bdec6',
              'galaxy-ap-password': '53fa790fcb4c412b86278d941f25eec7',
              'galaxy-search-type': 'DevAPIContactID',
              'content-type': 'application/json',
              'galaxy-client-type': 'DevAPIContactEnrich',
            },
            data: {
              "PersonID": `${targetOfficer.PersonID}`
            }
  
          })
          // console.log("res from contactID =>", response.data)
          officersList[i].contactDetails = filterEmails_Phones(response.data);
          //console.log("officersList after id search", officersList)
  
  
  
        } catch (error) {
          console.error("Error From SearchContact=> id search :", error.message);
        };
  
      }
      //*contact enrich
      else {
        try {
          const response = await axios.request({
            method: 'POST',
            url: 'https://devapi.endato.com/Contact/Enrich',
            headers: {
              accept: 'application/json',
              'galaxy-ap-name': '12b8b798-8854-49ac-878c-48ac1d6bdec6',
              'galaxy-ap-password': '53fa790fcb4c412b86278d941f25eec7',
              'galaxy-search-type': 'DevAPIContactEnrich',
              'content-type': 'application/json',
              'galaxy-client-type': 'DevAPIContactEnrich',
            },
            data: {
              "FirstName": `${targetOfficer['FirstName']}`,
              "LastName": `${targetOfficer['LastName']}`,
              "Address": {
  
                "addressLine2": `${targetOfficer.Addresses['addressLine2']}`
              }
            }
  
          })
          officersList[i].contactDetails = filterEmails_Phones(response.data)
          //  console.log("officersList after enrich search", officersList)
  
          
  
        } catch (error) {
          console.error("Error From SearchContact => enrich search :", error.message);
        };
  
  
      }

    },i*1000)

    ContactEnrichIndex += 1 

  }

  return officersList;
};

const add_finalObj_inAirTable = function (finalObj) {
  const YOUR_BASE_ID = 'app86hwp15Ka1dXEC';
  // const YOUR_API_KEY = 'pat5Agjq0EkAWWhWz.ed5dc3086cdf35cc71c5b8d0fd7f75a03edce140385958ea527b4d18c63a3b12';
  const YOUR_API_KEY = 'patSavjYsBOdkbgnU.ccda4116f516d8ed0620fb934afb552c34b7ecc28f6b1895fbf51470939fae31';
  const tabelIDofficers = 'tblKUidlysKdb3y0j';
  const tabelIDcompanies = 'tblBa05Kbq4DKt6bb'

  const Airtable = require('airtable');
  const base = new Airtable({ apiKey: YOUR_API_KEY }).base(YOUR_BASE_ID);
  // console.log("finalObjxxxxxxxx😒", finalObj)
  const PrimaryNames = finalObj['Primary Names']
  const CopyPasteURLs = finalObj['CopyPasteURLs']
  // Concatenate the array elements into a single string with a delimiter
  const delimiter = ', '; // You can use any delimiter you prefer
  const companyNames = PrimaryNames.join(delimiter);
  // console.log('companyNames: ', companyNames);
  const CopyPasteURLsList = CopyPasteURLs.join(delimiter)
  base(tabelIDcompanies).create(
    [
      {
        fields: {
          'result': finalObj['result'],
          'Bureau Number': finalObj['Bureau Number'],
          // 'Primary Name': finalObj['Primary Name'],
          'Company Names': companyNames,
          'Street Address': finalObj['Street Address'],
          'City': finalObj['City'],
          'State': finalObj['State'],
          'Zip Code': finalObj['Zip Code'],
          'County': finalObj['County'],
          'Governing Class': finalObj['Governing Class'],
          "Description": finalObj['Description'],
          "Ex Mod Year": finalObj['Ex Mod Year'],
          "ExMod": finalObj['ExMod'],
          "Updated On": finalObj['Updated On'],
          "ExMod Change": finalObj['ExMod Change'],
          "Insurer Name": finalObj['Insurer Name'],
          "Insurer Group": finalObj['Insurer Group'],
          "Advisory Rate": finalObj['Advisory Rate'],
          "Rate Eff Date": finalObj['Rate Eff Date'],
          "SubClass1": finalObj['SubClass1'],
          "Desc1": finalObj['Desc1'],
          "SubClass2": finalObj['SubClass2'],
          "Desc2": finalObj['Desc2'],
          "PriorExModYear1": finalObj['PriorExModYear1'],
          "PriorExMod1": finalObj['PriorExMod1'],
          "PriorExModYear2": finalObj['PriorExModYear2'],
          "PriorExMod2": finalObj['PriorExMod2'],
          "PriorExModYear3": finalObj['PriorExModYear3'],
          "PriorExMod3": finalObj['PriorExMod3'],
          "PriorExModYear4": finalObj['PriorExModYear4'],
          "PriorExMod4": finalObj['PriorExMod4'],
          "GoogleSearch": finalObj['GoogleSearch'],
          // "CopyPasteURL": finalObj['CopyPasteURL'],
          "CopyPasteURLs": CopyPasteURLsList
        },
      },
    ],
  ).then((records) => {
    //   console.log("finalObj.officersxxxx before airTableadd😒", finalObj.officers)
    if (finalObj.officers.length > 0) {
      const officers = finalObj.officers.map((officer) => ({
        fields: {
          'Person ID': officer['PersonID'],
          'First Name': officer['FirstName'],
          'Last Name': officer['LastName'],
          //'address': officer['Addresses'].addressLine2,
          'Full Name': officer['fullName'],
          // 'Street': officer['Street'],
          // 'City': officer['City'],
          // 'State': officer['State'],
          // 'postal/zip code': officer['postalCode'],
          'Street': officer['contactDetails']?.addresses?.street,
          'City': officer['contactDetails']?.addresses?.city,
          'State': officer['contactDetails']?.addresses?.state,
          'postal/zip code': officer['contactDetails']?.addresses?.zip,
          'phone 1': officer['contactDetails']?.phones[0],
          'phone 2': officer['contactDetails']?.phones[1],
          'phone 3': officer['contactDetails']?.phones[2],
          'phone 4': officer['contactDetails']?.phones[3],
          'phone 5': officer['contactDetails']?.phones[4],
          'phone 6': officer['contactDetails']?.phones[5],
          'email 1': officer['contactDetails']?.emails[0],
          'email 2': officer['contactDetails']?.emails[1],
          'email 3': officer['contactDetails']?.emails[2],
          'email 4': officer['contactDetails']?.emails[3],
          'email 5': officer['contactDetails']?.emails[4],
          'email 6': officer['contactDetails']?.emails[5],
          'company': [records[0]?.id], // Link officers to the company record
        },
      }));

      base(tabelIDofficers).create(officers, (officerErr) => {
        if (officerErr) {
          console.error("from adding data to airtable📢", officerErr);
          //  return;
        }
        console.log('Company and Officer data added successfully.');
        console.log("BusinessV2SearchIndexCounter: "+BusinessV2SearchIndexCounter);
        BusinessV2SearchIndexCounter = 0;
        console.log("ContactEnrichIndex: "+ContactEnrichIndex);
        ContactEnrichIndex = 0;
      });
    }

    console.log('Company  data only added 📢📢.');


  }).catch((err) => {
    console.error(err);
    // return;
  });

};

async function step2final_SearchContact(BusinessNames, res) {
  for (let i = 0; i < BusinessNames.length; i++) {
     // await new Promise((resolve) => setTimeout(resolve, 1000)); // Add a delay of 300ms
      //  console.log("new Search busines ❤️❤️ :", i);
      setTimeout(async()=>{
        let tempObj = BusinessNames[i]
        tempObj.officers = []
        for (let x = 0; x < BusinessNames[i]["Primary Names"].length; x++) {
          
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Add a delay of 300ms
 
            try {
              console.log(`😒😒😒bus started search ${x}`)
              const response = await axios.request({
                method: 'POST',
                url: 'https://devapi.endato.com/BusinessV2Search',
                headers: {
                  accept: 'application/json',
                  'galaxy-ap-name': '12b8b798-8854-49ac-878c-48ac1d6bdec6',
                  'galaxy-ap-password': '53fa790fcb4c412b86278d941f25eec7',
                  'galaxy-search-type': 'BusinessV2',
                  'content-type': 'application/json',
                  'galaxy-client-type': 'DevAPIContactEnrich',
                },
                data: {
                  "businessName": `${BusinessNames[i]["Primary Names"][x]}`,
                  "addressLine2": `${BusinessNames[i].City}, ${BusinessNames[i].State}`
                }
    
              })
              console.log("😒😒😒bus end search")
              BusinessV2SearchIndexCounter += 1;
              if (response.data["businessV2Records"].length === 0) {
                tempObj.result = `no business result for ${BusinessNames[i]["Primary Names"][x]} `;
                console.log("🤦‍♂️🤦‍♂️", " empty [] in business search", tempObj);
              } else {
                let searchBusinssRes;
                if (response.data["businessV2Records"][0]['newBusinessFilings']?.length === 0) {
                  console.log("📢📢📢usCorpFilings start ....")
                  searchBusinssRes = collect_officers_from_eachbusinessSearch(response.data);
                }
    
                if (response.data["businessV2Records"][0]['usCorpFilings']?.length === 0) {
                  console.log("📢📢📢newBusinessFilings start ....")
                  searchBusinssRes = collect_officers_from_NewResponse(response.data)
                }
    
                tempObj.officers.push(searchBusinssRes)
                console.log("📢📢📢📢📢📢📢📢📢 one after adding officers",tempObj)
              }
    
            } catch (error) {
              console.error("Error From Search business function :", error.message);
            };

          
    
  
        }

        if (tempObj.officers.length > 0) {
          let OfficersDataList = [].concat(...tempObj.officers)
          OfficersDataList = filterOfficersData(OfficersDataList).slice(0, 5)
          tempObj.officers = OfficersDataList;
  
          searchForConacts(tempObj.officers).then((res) => {
            tempObj.officers = res
            console.log("FinalObj📢", tempObj)
            add_finalObj_inAirTable(tempObj)
          }).catch(err => {
            console.log("err for new function of getting contacts", err.message)
          })
  
        }
        else {
          tempObj.result = "There is no officers results ";
          console.log("😒😒 officers are empty array ... ")
          tempObj.officers = [];
          searchForConacts(tempObj.officers).then((res) => {
            tempObj.officers = res
            console.log("FinalObj📢", tempObj)
            add_finalObj_inAirTable(tempObj)
          }).catch(err => {
            console.log("err for new function of getting contacts", err.message)
          })
        }

      }, i*1000)



  }
  res.status(200).json({ message: 'Data processed successfully' });
};

async function readDataFromFS_ToAirTable(filePath, res) {
  try {
    const data = await util.promisify(fs.readFile)(filePath, 'utf8');
    const jsonData = JSON.parse(data);

    console.log("📢📢📢📢", "data read ...");
    console.log('jsonData: ', jsonData);

    // Perform the complex logic and searches using async/await
    await step2final_SearchContact(jsonData, res);

    // After all operations are complete, send the response
    //res.status(200).json({ message: 'Data processed successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error processing data' });
  }
};

let test = {
  "businessV2Records": [
      {
          "poseidonId": -5329618998819948389,
          "uccFilings": [],
          "newBusinessFilings": [],
          "usCorpFilings": [
              {
                  "poseidonId": -5329618998819948389,
                  "ein": "",
                  "name": "INTERNATIONAL BONDED COURIERS INC",
                  "rawName": "INTERNATIONAL BONDED COURIERS, INC.",
                  "corpFileKey": "CAC2463863",
                  "corpStatus": "ACTIVE",
                  "corpStatusDate": "08/25/2021",
                  "corpType": "FOREIGN CORPORATION",
                  "registryNumber": "C2463863",
                  "stateCode": "CA",
                  "statute": "",
                  "stateTaxId": "",
                  "term": "",
                  "fileData": null,
                  "fileDataDate": "9/8/2021",
                  "filingDate": "8/19/2002",
                  "incorporationState": "FL",
                  "filingType": "SI-COMPLETE",
                  "jurisdiction": "",
                  "lastReportedDate": "08/25/2021",
                  "expireDate": "",
                  "contacts": [],
                  "officers": [
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "8722164213855312689",
                              "nameFirst": "Joseph",
                              "nameGender": "M",
                              "nameLast": "Costigan",
                              "nameMiddle": "F",
                              "nameRaw": "JOSEPH F COSTIGAN",
                              "nameProblemCodes": "NS01,NS05,NS06",
                              "nameHashOpt5": -7979037719456451024,
                              "namePrefix": "",
                              "nameHashOpt4": -8695878780235399942,
                              "nameSuffixNorm": "",
                              "tahoeId": "G8261360941320991846"
                          },
                          "title": "PRESIDENT",
                          "startDate": "20210930",
                          "status": null,
                          "address": {
                              "city": "New Hyde Park",
                              "state": "NY",
                              "zip": "11042",
                              "county": "Nassau",
                              "country": "",
                              "addressHash": "-3108044340243593154",
                              "houseNumber": "3333",
                              "streetName": "New Hyde Park",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "3333 New Hyde Park",
                              "addressLine2": "New Hyde Park, NY 11042",
                              "fullAddress": "3333 New Hyde Park; New Hyde Park, NY 11042"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "-7108088675533382544",
                              "nameFirst": "Gus",
                              "nameGender": "M",
                              "nameLast": "Bilbao",
                              "nameMiddle": "",
                              "nameRaw": "GUS BILBAO",
                              "nameProblemCodes": "NS01,NS05,NS06",
                              "nameHashOpt5": -4633808196167399232,
                              "namePrefix": "",
                              "nameHashOpt4": -5519987421323859550,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "REGISTERED AGENT",
                          "startDate": "20210930",
                          "status": null,
                          "address": {
                              "city": "Inglewood",
                              "state": "CA",
                              "zip": "90304",
                              "county": "Los Angeles",
                              "country": "",
                              "addressHash": "4577836034834162194",
                              "houseNumber": "11034",
                              "streetName": "La Cienega",
                              "streetPostDirection": "",
                              "streetPreDirection": "S",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "11034 S La Cienega",
                              "addressLine2": "Inglewood, CA 90304",
                              "fullAddress": "11034 S La Cienega; Inglewood, CA 90304"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "8722164213855312689",
                              "nameFirst": "Joseph",
                              "nameGender": "M",
                              "nameLast": "Costigan",
                              "nameMiddle": "Thomas",
                              "nameRaw": "JOSEPH THOMAS COSTIGAN",
                              "nameProblemCodes": "NS01,NS05,NS06",
                              "nameHashOpt5": 6402436799882248524,
                              "namePrefix": "",
                              "nameHashOpt4": 4110025790675873967,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "PRESIDENT",
                          "startDate": "20210930",
                          "status": null,
                          "address": {
                              "city": "Jamaica",
                              "state": "NY",
                              "zip": "11434",
                              "county": "Queens",
                              "country": "",
                              "addressHash": "2651845322265799949",
                              "houseNumber": "15201",
                              "streetName": "Rockaway",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "15201 Rockaway",
                              "addressLine2": "Jamaica, NY 11434",
                              "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "-8162728228316344038",
                              "nameFirst": "Simon",
                              "nameGender": "M",
                              "nameLast": "Higgs",
                              "nameMiddle": "",
                              "nameRaw": "SIMON HIGGS",
                              "nameProblemCodes": "NS01,NS05,NS06",
                              "nameHashOpt5": 788332595457292767,
                              "namePrefix": "",
                              "nameHashOpt4": 1024689275106781917,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "PRESIDENT",
                          "startDate": "20210930",
                          "status": null,
                          "address": {
                              "city": "Jamaica",
                              "state": "NY",
                              "zip": "11434",
                              "county": "Queens",
                              "country": "",
                              "addressHash": "2651845322265799949",
                              "houseNumber": "15201",
                              "streetName": "Rockaway",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "15201 Rockaway",
                              "addressLine2": "Jamaica, NY 11434",
                              "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "8722164213855312689",
                              "nameFirst": "Joseph",
                              "nameGender": "M",
                              "nameLast": "Costigan",
                              "nameMiddle": "T",
                              "nameRaw": "JOSEPH T COSTIGAN",
                              "nameProblemCodes": "NS01,NS05,NS06",
                              "nameHashOpt5": -2182924100697023145,
                              "namePrefix": "",
                              "nameHashOpt4": -6174434230441542346,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "PRESIDENT",
                          "startDate": "20210930",
                          "status": null,
                          "address": {
                              "city": "Jamaica",
                              "state": "NY",
                              "zip": "11434",
                              "county": "Queens",
                              "country": "",
                              "addressHash": "2651845322265799949",
                              "houseNumber": "15201",
                              "streetName": "Rockaway",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "15201 Rockaway",
                              "addressLine2": "Jamaica, NY 11434",
                              "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      }
                  ],
                  "phones": null,
                  "emails": [],
                  "stock": {
                      "stateCode": "",
                      "stockClass": "",
                      "stockDate": "",
                      "stockParValue": "",
                      "stockRestrictInd": "",
                      "stockSharesAuth": ""
                  },
                  "merger": {
                      "eventDescription": "",
                      "mergeDate": "",
                      "mergedCorpId": "",
                      "mergedCorpName": "",
                      "stateCode": "",
                      "survivingCorpId": ""
                  },
                  "history": {
                      "amendmentDate": "20140521",
                      "amendmentType": "SECRETARY OF STATE REVIVER",
                      "corpFileKey": "CAC2463863",
                      "historyEvent": null,
                      "stateCode": "CA"
                  },
                  "alternateName": {
                      "name": "",
                      "amendmentDate": "",
                      "certificationDate": "",
                      "consentName": "",
                      "corpFileKey": "",
                      "expireDate": "",
                      "filingDate": "",
                      "nameType": "",
                      "purpose": "",
                      "registryNumber": "",
                      "renewalDate": "",
                      "similarAltName": "",
                      "stateCode": "",
                      "stateOfOrigin": "",
                      "status": "",
                      "statusDate": "",
                      "xRef1Name": "",
                      "xRef2Name": ""
                  },
                  "corpMainAddresses": [
                      {
                          "city": "Jamaica",
                          "state": "NY",
                          "zip": "11434",
                          "county": "Queens",
                          "country": "",
                          "addressHash": "2651845322265799949",
                          "houseNumber": "15201",
                          "streetName": "Rockaway",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "15201 Rockaway",
                          "addressLine2": "Jamaica, NY 11434",
                          "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                      },
                      {
                          "city": "Jamaica",
                          "state": "NY",
                          "zip": "11435",
                          "county": "Queens",
                          "country": "",
                          "addressHash": "8620487858193709590",
                          "houseNumber": "14035",
                          "streetName": "Queens",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "14035 Queens",
                          "addressLine2": "Jamaica, NY 11435",
                          "fullAddress": "14035 Queens; Jamaica, NY 11435"
                      },
                      {
                          "city": "Ny 11042 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "6576889406387612763",
                          "houseNumber": "",
                          "streetName": "STE",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "New Hyde",
                          "addressLine1": "STE",
                          "addressLine2": "Ny 11042 Null",
                          "fullAddress": "STE; Ny 11042 Null"
                      },
                      {
                          "city": "Tx 78701 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "-8332944204220181098",
                          "houseNumber": "1050",
                          "streetName": "NULL BRAZOS NULL",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "AUSTIN",
                          "unitType": "Ste",
                          "addressLine1": "1050 NULL BRAZOS NULL, Ste AUSTIN",
                          "addressLine2": "Tx 78701 Null",
                          "fullAddress": "1050 NULL BRAZOS NULL, Ste AUSTIN; Tx 78701 Null"
                      },
                      {
                          "city": "Ny 11435 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "5443747082910272762",
                          "houseNumber": "",
                          "streetName": "NULL QUEENS NULL BOULEVARD NULL NULL JAMAICA",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "NULL QUEENS NULL BOULEVARD NULL NULL JAMAICA",
                          "addressLine2": "Ny 11435 Null",
                          "fullAddress": "NULL QUEENS NULL BOULEVARD NULL NULL JAMAICA; Ny 11435 Null"
                      },
                      {
                          "city": "Jamaica",
                          "state": "NY",
                          "zip": "11434",
                          "county": "Queens",
                          "country": "",
                          "addressHash": "2651845322265799949",
                          "houseNumber": "15201",
                          "streetName": "Rockaway",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "15201 Rockaway",
                          "addressLine2": "Jamaica, NY 11434",
                          "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                      },
                      {
                          "city": "Ny 11042 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "6576889406387612763",
                          "houseNumber": "",
                          "streetName": "STE",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "New Hyde",
                          "addressLine1": "STE",
                          "addressLine2": "Ny 11042 Null",
                          "fullAddress": "STE; Ny 11042 Null"
                      },
                      {
                          "city": "Fl 33126 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "2957651274210702438",
                          "houseNumber": "NW",
                          "streetName": "17TH NULL",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "NW 17TH NULL",
                          "addressLine2": "Fl 33126 Null",
                          "fullAddress": "NW 17TH NULL; Fl 33126 Null"
                      },
                      {
                          "city": "Ny 10956 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "1778900053374176000",
                          "houseNumber": "13",
                          "streetName": "NULL ESQUIRE NULL",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "NEW CITY",
                          "unitType": "Ste",
                          "addressLine1": "13 NULL ESQUIRE NULL, Ste NEW CITY",
                          "addressLine2": "Ny 10956 Null",
                          "fullAddress": "13 NULL ESQUIRE NULL, Ste NEW CITY; Ny 10956 Null"
                      },
                      {
                          "city": "Fl 33332 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "-7836607650404677321",
                          "houseNumber": "",
                          "streetName": "",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "",
                          "addressLine2": "Fl 33332 Null",
                          "fullAddress": "Fl 33332 Null"
                      },
                      {
                          "city": "Fl 33152 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "8006269354699913006",
                          "houseNumber": "NULL",
                          "streetName": "PO Box",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "Null",
                          "addressLine1": "PO Box NULL",
                          "addressLine2": "Fl 33152 Null",
                          "fullAddress": "PO Box NULL; Fl 33152 Null"
                      },
                      {
                          "city": "Jamaica",
                          "state": "NY",
                          "zip": "11434",
                          "county": "Queens",
                          "country": "",
                          "addressHash": "2651845322265799949",
                          "houseNumber": "15201",
                          "streetName": "Rockaway",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "15201 Rockaway",
                          "addressLine2": "Jamaica, NY 11434",
                          "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                      }
                  ]
              }
          ]
      },
      {
          "poseidonId": -4133746263264037950,
          "uccFilings": [],
          "newBusinessFilings": [
              {
                  "poseidonId": -4133746263264037950,
                  "ein": "",
                  "businessId": 123638145,
                  "businessUrl": "IBCINC.COM",
                  "dbaNameId": null,
                  "nbfSourceId": null,
                  "company": "INTERNATIONAL BONDED COURIERS INC",
                  "contacts": [
                      {
                          "companyFlag": false,
                          "contactId": 49278750,
                          "contactTypeDesc": "OFFICER 1",
                          "contactTypeId": 14,
                          "genderId": 802,
                          "genderTypeDesc": "MALE",
                          "name": {
                              "firstName": "Joseph",
                              "fullName": "JOSEPH T COSTIGANO",
                              "lastName": "Costigano",
                              "middleInit": "T",
                              "suffix": ""
                          },
                          "nbfRecordNo": "20150312_26106",
                          "nbfSourceId": 900034,
                          "titleId": 99,
                          "tahoeId": null,
                          "officerTitleDesc": "CHAIRMAN",
                          "officerTitleId": 99,
                          "ethnicTypeDesc": null,
                          "ethnicId": null
                      }
                  ],
                  "addresses": [
                      {
                          "addressType": "S",
                          "addressTypeDesc": "OFFICER 1 ADDRESS",
                          "addressTypeId": 14,
                          "barCode": "/114342867013/",
                          "carrierRoute": "C010",
                          "checkDigit": "3",
                          "commercialFlag": true,
                          "dp": "01",
                          "dpUnknown": "-1",
                          "dpc": "01",
                          "errorNumber": "11.14,14.5,A1",
                          "ffApplied": "",
                          "financeNumber": "354170",
                          "lacs": "",
                          "lot": "0026",
                          "matchFlag": "",
                          "moveDate": "",
                          "moveType": "",
                          "nbfRecordNo": "20150312_26106",
                          "nbfSourceId": 900034,
                          "nxi": "",
                          "poBoxFlag": false,
                          "residentialFlag": false,
                          "status": "V",
                          "timeZone": "EST",
                          "city": "Jamaica",
                          "state": "NY",
                          "zip": "11434",
                          "county": "Queens",
                          "houseNumber": "15201",
                          "streetName": "Rockaway",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "15201 Rockaway",
                          "addressLine2": "Jamaica, NY 11434",
                          "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                      },
                      {
                          "addressType": "S",
                          "addressTypeDesc": "MAIL ADDRESS",
                          "addressTypeId": 10,
                          "barCode": "/114342867013/",
                          "carrierRoute": "C010",
                          "checkDigit": "3",
                          "commercialFlag": true,
                          "dp": "01",
                          "dpUnknown": "-1",
                          "dpc": "01",
                          "errorNumber": "11.14,14.5,A1",
                          "ffApplied": "",
                          "financeNumber": "354170",
                          "lacs": "",
                          "lot": "0026",
                          "matchFlag": "",
                          "moveDate": "",
                          "moveType": "",
                          "nbfRecordNo": "20150312_26106",
                          "nbfSourceId": 900034,
                          "nxi": "",
                          "poBoxFlag": false,
                          "residentialFlag": false,
                          "status": "V",
                          "timeZone": "EST",
                          "city": "Jamaica",
                          "state": "NY",
                          "zip": "11434",
                          "county": "Queens",
                          "houseNumber": "15201",
                          "streetName": "Rockaway",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "15201 Rockaway",
                          "addressLine2": "Jamaica, NY 11434",
                          "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                      }
                  ],
                  "corpFlag": "YES",
                  "description": null,
                  "nbfRecordNo": "20150312_26106",
                  "emails": [],
                  "franchiseFlag": "NO",
                  "freqTypeDesc": "W",
                  "freqTypeId": 53,
                  "homeOffice": "NO",
                  "legalBusinessDescription": null,
                  "legalBusinessDescriptionId": null,
                  "licenseTypeDesc": "CORPORATION",
                  "licenseTypeId": 131,
                  "nbeFlag": "YES",
                  "data": {
                      "courtCode": "3600102",
                      "filingNumber": "1017651",
                      "freqId": 53,
                      "importFileName": "900034_0311.txt",
                      "licenseTypeId": 131,
                      "nbfDataId": 39618094,
                      "nbfProcessDate": "03/12/2015",
                      "nbfRecordNo": "20150312_26106",
                      "nbfSourceId": 900034,
                      "statusId": 39
                  },
                  "nbfDates": null,
                  "filingHistoryDates": [
                      {
                          "date": "03/02/2015",
                          "dateId": 112880897,
                          "dateTypeId": 767,
                          "dateTypeDesc": "SOURCE FILING DATE",
                          "nbfRecordNo": "20150312_26106",
                          "nbfSourceId": 900034
                      },
                      {
                          "date": "03/12/2015",
                          "dateId": 112919664,
                          "dateTypeId": 809,
                          "dateTypeDesc": "LOAD DATE",
                          "nbfRecordNo": "20150312_26106",
                          "nbfSourceId": 900034
                      }
                  ],
                  "nonProfiltFlag": "NO",
                  "owningCompany": null,
                  "sic": "9721",
                  "phones": [
                      {
                          "appendedDate": null,
                          "appendedFlag": null,
                          "appendedScore": null,
                          "dncFlag": null,
                          "duplicateFlag": null,
                          "nbfRecordNo": null,
                          "nbfSourceId": null,
                          "newConnectFlag": null,
                          "phoneId": null,
                          "phoneTypeId": null,
                          "wirelessFlag": null,
                          "phoneTypeDesc": null,
                          "phoneNumber": "(718) 712-0271"
                      }
                  ],
                  "solicitFlag": "YES",
                  "statusDesc": "ACTIVE, ACCEPTED, CURRENT",
                  "statusId": 39
              }
          ],
          "usCorpFilings": []
      },
      {
          "poseidonId": -1757726767836193013,
          "uccFilings": [],
          "newBusinessFilings": [],
          "usCorpFilings": [
              {
                  "poseidonId": -1757726767836193013,
                  "ein": "",
                  "name": "INTERNATIONAL BONDED COURIERS INC",
                  "rawName": "INTERNATIONAL BONDED COURIERS, INC.",
                  "corpFileKey": "TX0008860206",
                  "corpStatus": "IN EXISTENCE",
                  "corpStatusDate": "06/27/2023",
                  "corpType": "FOREIGN BUSINESS CORPORATION",
                  "registryNumber": "0008860206",
                  "stateCode": "TX",
                  "statute": "",
                  "stateTaxId": "15921667935",
                  "term": "PERPETUAL",
                  "fileData": null,
                  "fileDataDate": "6/28/2023",
                  "filingDate": "8/21/1991",
                  "incorporationState": "FL",
                  "filingType": "PUBLIC INFORMATION REPORT (PIR)",
                  "jurisdiction": "",
                  "lastReportedDate": "06/27/2023",
                  "expireDate": "",
                  "contacts": [],
                  "officers": [
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "8722164213855312689",
                              "nameFirst": "Joseph",
                              "nameGender": "M",
                              "nameLast": "Costigan",
                              "nameMiddle": "F",
                              "nameRaw": "JOSEPH F COSTIGAN",
                              "nameProblemCodes": "NS01,NS05,NS06",
                              "nameHashOpt5": -7979037719456451024,
                              "namePrefix": "",
                              "nameHashOpt4": -8695878780235399942,
                              "nameSuffixNorm": "",
                              "tahoeId": "G8261360941320991846"
                          },
                          "title": "DIRECTOR,P,PRESIDENT",
                          "startDate": "20230630",
                          "status": null,
                          "address": {
                              "city": "New Hyde Park",
                              "state": "NY",
                              "zip": "11042",
                              "county": "Nassau",
                              "country": "",
                              "addressHash": "3589988993477662267",
                              "houseNumber": "3333",
                              "streetName": "New Hyde Park",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "300",
                              "unitType": "Ste",
                              "addressLine1": "3333 New Hyde Park, Ste 300",
                              "addressLine2": "New Hyde Park, NY 11042",
                              "fullAddress": "3333 New Hyde Park, Ste 300; New Hyde Park, NY 11042"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "8722164213855312689",
                              "nameFirst": "Joseph",
                              "nameGender": "M",
                              "nameLast": "Costigan",
                              "nameMiddle": "",
                              "nameRaw": "JOSEPH COSTIGAN",
                              "nameProblemCodes": "NS01,NS05,NS06",
                              "nameHashOpt5": -6190296137820758388,
                              "namePrefix": "",
                              "nameHashOpt4": -7603968659974128827,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "CFO",
                          "startDate": "20230630",
                          "status": null,
                          "address": {
                              "city": "Jamaica",
                              "state": "NY",
                              "zip": "21434",
                              "county": "Queens",
                              "country": "",
                              "addressHash": "5528694373261013974",
                              "houseNumber": "252-01",
                              "streetName": "ROCKAWAY",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "252-01 ROCKAWAY",
                              "addressLine2": "Jamaica, NY 21434",
                              "fullAddress": "252-01 ROCKAWAY; Jamaica, NY 21434"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "8722164213855312689",
                              "nameFirst": "Joseph",
                              "nameGender": "M",
                              "nameLast": "Costigan",
                              "nameMiddle": "E",
                              "nameRaw": "JOSEPH E COSTIGAN",
                              "nameProblemCodes": "NS01,NS05,NS06",
                              "nameHashOpt5": 8035858235161698524,
                              "namePrefix": "",
                              "nameHashOpt4": -2460851190382100223,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "DIRECTOR,PRESIDENT",
                          "startDate": "20230630",
                          "status": null,
                          "address": {
                              "city": "New Hyde Park",
                              "state": "NY",
                              "zip": "11042",
                              "county": "Nassau",
                              "country": "",
                              "addressHash": "3589988993477662267",
                              "houseNumber": "3333",
                              "streetName": "New Hyde Park",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "300",
                              "unitType": "Ste",
                              "addressLine1": "3333 New Hyde Park, Ste 300",
                              "addressLine2": "New Hyde Park, NY 11042",
                              "fullAddress": "3333 New Hyde Park, Ste 300; New Hyde Park, NY 11042"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "461214708924601062",
                              "nameFirst": "Richard",
                              "nameGender": "M",
                              "nameLast": "Crai",
                              "nameMiddle": "",
                              "nameRaw": "RICHARD CRAI",
                              "nameProblemCodes": "NS01,NS05",
                              "nameHashOpt5": 2368970297284960450,
                              "namePrefix": "",
                              "nameHashOpt4": -338598189921246984,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "PRESIDENT,REGISTERED AGENT",
                          "startDate": "20230630",
                          "status": null,
                          "address": {
                              "city": "Ridgefield",
                              "state": "CT",
                              "zip": "06877",
                              "county": "Fairfield",
                              "country": "",
                              "addressHash": "1197840931380904619",
                              "houseNumber": "35",
                              "streetName": "Cooper Hill",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "35 Cooper Hill",
                              "addressLine2": "Ridgefield, CT 06877",
                              "fullAddress": "35 Cooper Hill; Ridgefield, CT 06877"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": "",
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "8722164213855312689",
                              "nameFirst": "F",
                              "nameGender": "U",
                              "nameLast": "Costigan",
                              "nameMiddle": "",
                              "nameRaw": "F COSTIGAN",
                              "nameProblemCodes": "NS01,NS06",
                              "nameHashOpt5": -7104362347375432879,
                              "namePrefix": "",
                              "nameHashOpt4": -4655344729275058998,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "",
                          "startDate": "20160901",
                          "status": "",
                          "address": null,
                          "mailingAddress": null,
                          "fax": "19332744",
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "-2945357929586404158",
                              "nameFirst": "Corporation",
                              "nameGender": "U",
                              "nameLast": "Company",
                              "nameMiddle": "Service",
                              "nameRaw": "CORPORATION SERVICE COMPANY",
                              "nameProblemCodes": "NS02,NE05",
                              "nameHashOpt5": 8774763985741400136,
                              "namePrefix": "",
                              "nameHashOpt4": -5172639837793446601,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "REGISTERED AGENT",
                          "startDate": "20230630",
                          "status": null,
                          "address": {
                              "city": "Austin",
                              "state": "TX",
                              "zip": "78701",
                              "county": "Travis",
                              "country": "",
                              "addressHash": "3910855407320074394",
                              "houseNumber": "800",
                              "streetName": "Brazos",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "800 Brazos",
                              "addressLine2": "Austin, TX 78701",
                              "fullAddress": "800 Brazos; Austin, TX 78701"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": "",
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "8722164213855312689",
                              "nameFirst": "E",
                              "nameGender": "U",
                              "nameLast": "Costigan",
                              "nameMiddle": "",
                              "nameRaw": "E COSTIGAN",
                              "nameProblemCodes": "NS01,NS06",
                              "nameHashOpt5": -4616836915556897433,
                              "namePrefix": "",
                              "nameHashOpt4": -2896499316900874159,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "",
                          "startDate": "20160901",
                          "status": "",
                          "address": null,
                          "mailingAddress": null,
                          "fax": "13349983",
                          "email": null
                      }
                  ],
                  "phones": null,
                  "emails": [],
                  "stock": {
                      "stateCode": "",
                      "stockClass": "",
                      "stockDate": "",
                      "stockParValue": "",
                      "stockRestrictInd": "",
                      "stockSharesAuth": ""
                  },
                  "merger": {
                      "eventDescription": "",
                      "mergeDate": "",
                      "mergedCorpId": "",
                      "mergedCorpName": "",
                      "stateCode": "",
                      "survivingCorpId": ""
                  },
                  "history": {
                      "amendmentDate": "20230627",
                      "amendmentType": "PUBLIC INFORMATION REPORT (PIR)",
                      "corpFileKey": "TX0008860206",
                      "historyEvent": "DOCUMENT #01261736330001",
                      "stateCode": "TX"
                  },
                  "alternateName": {
                      "name": "",
                      "amendmentDate": "",
                      "certificationDate": "",
                      "consentName": "",
                      "corpFileKey": "",
                      "expireDate": "",
                      "filingDate": "",
                      "nameType": "",
                      "purpose": "",
                      "registryNumber": "",
                      "renewalDate": "",
                      "similarAltName": "",
                      "stateCode": "",
                      "stateOfOrigin": "",
                      "status": "",
                      "statusDate": "",
                      "xRef1Name": "",
                      "xRef2Name": ""
                  },
                  "corpMainAddresses": [
                      {
                          "city": "Jamaica",
                          "state": "NY",
                          "zip": "11434",
                          "county": "Queens",
                          "country": "",
                          "addressHash": "2651845322265799949",
                          "houseNumber": "15201",
                          "streetName": "Rockaway",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "15201 Rockaway",
                          "addressLine2": "Jamaica, NY 11434",
                          "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                      },
                      {
                          "city": "Jamaica",
                          "state": "NY",
                          "zip": "11435",
                          "county": "Queens",
                          "country": "",
                          "addressHash": "8620487858193709590",
                          "houseNumber": "14035",
                          "streetName": "Queens",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "14035 Queens",
                          "addressLine2": "Jamaica, NY 11435",
                          "fullAddress": "14035 Queens; Jamaica, NY 11435"
                      },
                      {
                          "city": "Ny 11042 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "6576889406387612763",
                          "houseNumber": "",
                          "streetName": "STE",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "New Hyde",
                          "addressLine1": "STE",
                          "addressLine2": "Ny 11042 Null",
                          "fullAddress": "STE; Ny 11042 Null"
                      },
                      {
                          "city": "Tx 78701 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "-8332944204220181098",
                          "houseNumber": "1050",
                          "streetName": "NULL BRAZOS NULL",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "AUSTIN",
                          "unitType": "Ste",
                          "addressLine1": "1050 NULL BRAZOS NULL, Ste AUSTIN",
                          "addressLine2": "Tx 78701 Null",
                          "fullAddress": "1050 NULL BRAZOS NULL, Ste AUSTIN; Tx 78701 Null"
                      },
                      {
                          "city": "Ny 11435 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "5443747082910272762",
                          "houseNumber": "",
                          "streetName": "NULL QUEENS NULL BOULEVARD NULL NULL JAMAICA",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "NULL QUEENS NULL BOULEVARD NULL NULL JAMAICA",
                          "addressLine2": "Ny 11435 Null",
                          "fullAddress": "NULL QUEENS NULL BOULEVARD NULL NULL JAMAICA; Ny 11435 Null"
                      },
                      {
                          "city": "Jamaica",
                          "state": "NY",
                          "zip": "11434",
                          "county": "Queens",
                          "country": "",
                          "addressHash": "2651845322265799949",
                          "houseNumber": "15201",
                          "streetName": "Rockaway",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "15201 Rockaway",
                          "addressLine2": "Jamaica, NY 11434",
                          "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                      },
                      {
                          "city": "Ny 11042 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "6576889406387612763",
                          "houseNumber": "",
                          "streetName": "STE",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "New Hyde",
                          "addressLine1": "STE",
                          "addressLine2": "Ny 11042 Null",
                          "fullAddress": "STE; Ny 11042 Null"
                      },
                      {
                          "city": "Fl 33126 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "2957651274210702438",
                          "houseNumber": "NW",
                          "streetName": "17TH NULL",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "NW 17TH NULL",
                          "addressLine2": "Fl 33126 Null",
                          "fullAddress": "NW 17TH NULL; Fl 33126 Null"
                      },
                      {
                          "city": "Ny 10956 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "1778900053374176000",
                          "houseNumber": "13",
                          "streetName": "NULL ESQUIRE NULL",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "NEW CITY",
                          "unitType": "Ste",
                          "addressLine1": "13 NULL ESQUIRE NULL, Ste NEW CITY",
                          "addressLine2": "Ny 10956 Null",
                          "fullAddress": "13 NULL ESQUIRE NULL, Ste NEW CITY; Ny 10956 Null"
                      },
                      {
                          "city": "Fl 33332 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "-7836607650404677321",
                          "houseNumber": "",
                          "streetName": "",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "",
                          "addressLine2": "Fl 33332 Null",
                          "fullAddress": "Fl 33332 Null"
                      },
                      {
                          "city": "Fl 33152 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "8006269354699913006",
                          "houseNumber": "NULL",
                          "streetName": "PO Box",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "Null",
                          "addressLine1": "PO Box NULL",
                          "addressLine2": "Fl 33152 Null",
                          "fullAddress": "PO Box NULL; Fl 33152 Null"
                      },
                      {
                          "city": "Jamaica",
                          "state": "NY",
                          "zip": "11434",
                          "county": "Queens",
                          "country": "",
                          "addressHash": "2651845322265799949",
                          "houseNumber": "15201",
                          "streetName": "Rockaway",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "15201 Rockaway",
                          "addressLine2": "Jamaica, NY 11434",
                          "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                      }
                  ]
              }
          ]
      },
      {
          "poseidonId": -1027084114330246457,
          "uccFilings": [],
          "newBusinessFilings": [],
          "usCorpFilings": [
              {
                  "poseidonId": -1027084114330246457,
                  "ein": "",
                  "name": "INTERNATIONAL BONDED COURIERS INC",
                  "rawName": "INTERNATIONAL BONDED COURIERS, INC.",
                  "corpFileKey": "CA2463863",
                  "corpStatus": "ACTIVE",
                  "corpStatusDate": "08/25/2021",
                  "corpType": "FOREIGN STOCK CORPORATION - OUT OF STATE - STOCK",
                  "registryNumber": "2463863",
                  "stateCode": "CA",
                  "statute": "",
                  "stateTaxId": "",
                  "term": "",
                  "fileData": null,
                  "fileDataDate": "6/27/2022",
                  "filingDate": "8/19/2002",
                  "incorporationState": "FL",
                  "filingType": "SI-COMPLETE",
                  "jurisdiction": "",
                  "lastReportedDate": "08/25/2021",
                  "expireDate": "",
                  "contacts": [],
                  "officers": [
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "8722164213855312689",
                              "nameFirst": "Joseph",
                              "nameGender": "M",
                              "nameLast": "Costigan",
                              "nameMiddle": "F",
                              "nameRaw": "JOSEPH F COSTIGAN",
                              "nameProblemCodes": "NS01,NS05,NS06",
                              "nameHashOpt5": -7979037719456451024,
                              "namePrefix": "",
                              "nameHashOpt4": -8695878780235399942,
                              "nameSuffixNorm": "",
                              "tahoeId": "G8261360941320991846"
                          },
                          "title": "PRESIDENT",
                          "startDate": "20220801",
                          "status": null,
                          "address": {
                              "city": "New Hyde Park",
                              "state": "NY",
                              "zip": "11042",
                              "county": "Nassau",
                              "country": "",
                              "addressHash": "-3108044340243593154",
                              "houseNumber": "3333",
                              "streetName": "New Hyde Park",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "3333 New Hyde Park",
                              "addressLine2": "New Hyde Park, NY 11042",
                              "fullAddress": "3333 New Hyde Park; New Hyde Park, NY 11042"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "-7108088675533382544",
                              "nameFirst": "Gus",
                              "nameGender": "M",
                              "nameLast": "Bilbao",
                              "nameMiddle": "",
                              "nameRaw": "GUS BILBAO",
                              "nameProblemCodes": "NS01,NS05,NS06",
                              "nameHashOpt5": -4633808196167399232,
                              "namePrefix": "",
                              "nameHashOpt4": -5519987421323859550,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "REGISTERED AGENT",
                          "startDate": "20220801",
                          "status": null,
                          "address": {
                              "city": "Inglewood",
                              "state": "CA",
                              "zip": "90304",
                              "county": "Los Angeles",
                              "country": "",
                              "addressHash": "4577836034834162194",
                              "houseNumber": "11034",
                              "streetName": "La Cienega",
                              "streetPostDirection": "",
                              "streetPreDirection": "S",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "11034 S La Cienega",
                              "addressLine2": "Inglewood, CA 90304",
                              "fullAddress": "11034 S La Cienega; Inglewood, CA 90304"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "8722164213855312689",
                              "nameFirst": "Joseph",
                              "nameGender": "M",
                              "nameLast": "Costigan",
                              "nameMiddle": "Thomas",
                              "nameRaw": "JOSEPH THOMAS COSTIGAN",
                              "nameProblemCodes": "NS01,NS05,NS06",
                              "nameHashOpt5": 6402436799882248524,
                              "namePrefix": "",
                              "nameHashOpt4": 4110025790675873967,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "CHIEF EXECUTIVE OFFICER",
                          "startDate": "20230403",
                          "status": null,
                          "address": {
                              "city": "Jamaica",
                              "state": "NY",
                              "zip": "11434",
                              "county": "Queens",
                              "country": "",
                              "addressHash": "2651845322265799949",
                              "houseNumber": "15201",
                              "streetName": "Rockaway",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "15201 Rockaway",
                              "addressLine2": "Jamaica, NY 11434",
                              "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "-5306207668924978040",
                              "nameFirst": "Efren",
                              "nameGender": "M",
                              "nameLast": "Canete",
                              "nameMiddle": "",
                              "nameRaw": "EFREN CANETE",
                              "nameProblemCodes": "NS01,NS05,NS06",
                              "nameHashOpt5": -5216469999231191903,
                              "namePrefix": "",
                              "nameHashOpt4": 4109645460028508284,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "REGISTERED AGENT",
                          "startDate": "20230403",
                          "status": null,
                          "address": {
                              "city": "Inglewood",
                              "state": "CA",
                              "zip": "90304",
                              "county": "Los Angeles",
                              "country": "",
                              "addressHash": "4577836034834162194",
                              "houseNumber": "11034",
                              "streetName": "La Cienega",
                              "streetPostDirection": "",
                              "streetPreDirection": "S",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "11034 S La Cienega",
                              "addressLine2": "Inglewood, CA 90304",
                              "fullAddress": "11034 S La Cienega; Inglewood, CA 90304"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "-8162728228316344038",
                              "nameFirst": "Simon",
                              "nameGender": "M",
                              "nameLast": "Higgs",
                              "nameMiddle": "",
                              "nameRaw": "SIMON HIGGS",
                              "nameProblemCodes": "NS01,NS05,NS06",
                              "nameHashOpt5": 788332595457292767,
                              "namePrefix": "",
                              "nameHashOpt4": 1024689275106781917,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "PRESIDENT",
                          "startDate": "20220801",
                          "status": null,
                          "address": {
                              "city": "Jamaica",
                              "state": "NY",
                              "zip": "11434",
                              "county": "Queens",
                              "country": "",
                              "addressHash": "2651845322265799949",
                              "houseNumber": "15201",
                              "streetName": "Rockaway",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "15201 Rockaway",
                              "addressLine2": "Jamaica, NY 11434",
                              "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "461214708924601062",
                              "nameFirst": "Richard",
                              "nameGender": "M",
                              "nameLast": "Crai",
                              "nameMiddle": "Frank",
                              "nameRaw": "RICHARD FRANK CRAI",
                              "nameProblemCodes": "NS01,NS05",
                              "nameHashOpt5": 2820516530300638173,
                              "namePrefix": "",
                              "nameHashOpt4": -6507055503139624184,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "CHIEF FINANCIAL OFFICER,SECRETARY",
                          "startDate": "20230403",
                          "status": null,
                          "address": {
                              "city": "Jamaica",
                              "state": "NY",
                              "zip": "11434",
                              "county": "Queens",
                              "country": "",
                              "addressHash": "2651845322265799949",
                              "houseNumber": "15201",
                              "streetName": "Rockaway",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "15201 Rockaway",
                              "addressLine2": "Jamaica, NY 11434",
                              "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "8722164213855312689",
                              "nameFirst": "Joseph",
                              "nameGender": "M",
                              "nameLast": "Costigan",
                              "nameMiddle": "T",
                              "nameRaw": "JOSEPH T COSTIGAN",
                              "nameProblemCodes": "NS01,NS05,NS06",
                              "nameHashOpt5": -2182924100697023145,
                              "namePrefix": "",
                              "nameHashOpt4": -6174434230441542346,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "PRESIDENT",
                          "startDate": "20220801",
                          "status": null,
                          "address": {
                              "city": "Jamaica",
                              "state": "NY",
                              "zip": "11434",
                              "county": "Queens",
                              "country": "",
                              "addressHash": "2651845322265799949",
                              "houseNumber": "15201",
                              "streetName": "Rockaway",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "15201 Rockaway",
                              "addressLine2": "Jamaica, NY 11434",
                              "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      }
                  ],
                  "phones": null,
                  "emails": [],
                  "stock": {
                      "stateCode": "",
                      "stockClass": "",
                      "stockDate": "",
                      "stockParValue": "",
                      "stockRestrictInd": "",
                      "stockSharesAuth": ""
                  },
                  "merger": {
                      "eventDescription": "",
                      "mergeDate": "",
                      "mergedCorpId": "",
                      "mergedCorpName": "",
                      "stateCode": "",
                      "survivingCorpId": ""
                  },
                  "history": {
                      "amendmentDate": "20210825",
                      "amendmentType": "SI-COMPLETE",
                      "corpFileKey": "CA2463863",
                      "historyEvent": "LBA16917477",
                      "stateCode": "CA"
                  },
                  "alternateName": {
                      "name": "",
                      "amendmentDate": "",
                      "certificationDate": "",
                      "consentName": "",
                      "corpFileKey": "",
                      "expireDate": "",
                      "filingDate": "",
                      "nameType": "",
                      "purpose": "",
                      "registryNumber": "",
                      "renewalDate": "",
                      "similarAltName": "",
                      "stateCode": "",
                      "stateOfOrigin": "",
                      "status": "",
                      "statusDate": "",
                      "xRef1Name": "",
                      "xRef2Name": ""
                  },
                  "corpMainAddresses": [
                      {
                          "city": "Jamaica",
                          "state": "NY",
                          "zip": "11434",
                          "county": "Queens",
                          "country": "",
                          "addressHash": "2651845322265799949",
                          "houseNumber": "15201",
                          "streetName": "Rockaway",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "15201 Rockaway",
                          "addressLine2": "Jamaica, NY 11434",
                          "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                      },
                      {
                          "city": "Jamaica",
                          "state": "NY",
                          "zip": "11435",
                          "county": "Queens",
                          "country": "",
                          "addressHash": "8620487858193709590",
                          "houseNumber": "14035",
                          "streetName": "Queens",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "14035 Queens",
                          "addressLine2": "Jamaica, NY 11435",
                          "fullAddress": "14035 Queens; Jamaica, NY 11435"
                      },
                      {
                          "city": "Ny 11042 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "6576889406387612763",
                          "houseNumber": "",
                          "streetName": "STE",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "New Hyde",
                          "addressLine1": "STE",
                          "addressLine2": "Ny 11042 Null",
                          "fullAddress": "STE; Ny 11042 Null"
                      },
                      {
                          "city": "Tx 78701 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "-8332944204220181098",
                          "houseNumber": "1050",
                          "streetName": "NULL BRAZOS NULL",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "AUSTIN",
                          "unitType": "Ste",
                          "addressLine1": "1050 NULL BRAZOS NULL, Ste AUSTIN",
                          "addressLine2": "Tx 78701 Null",
                          "fullAddress": "1050 NULL BRAZOS NULL, Ste AUSTIN; Tx 78701 Null"
                      },
                      {
                          "city": "Ny 11435 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "5443747082910272762",
                          "houseNumber": "",
                          "streetName": "NULL QUEENS NULL BOULEVARD NULL NULL JAMAICA",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "NULL QUEENS NULL BOULEVARD NULL NULL JAMAICA",
                          "addressLine2": "Ny 11435 Null",
                          "fullAddress": "NULL QUEENS NULL BOULEVARD NULL NULL JAMAICA; Ny 11435 Null"
                      },
                      {
                          "city": "Jamaica",
                          "state": "NY",
                          "zip": "11434",
                          "county": "Queens",
                          "country": "",
                          "addressHash": "2651845322265799949",
                          "houseNumber": "15201",
                          "streetName": "Rockaway",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "15201 Rockaway",
                          "addressLine2": "Jamaica, NY 11434",
                          "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                      },
                      {
                          "city": "Ny 11042 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "6576889406387612763",
                          "houseNumber": "",
                          "streetName": "STE",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "New Hyde",
                          "addressLine1": "STE",
                          "addressLine2": "Ny 11042 Null",
                          "fullAddress": "STE; Ny 11042 Null"
                      },
                      {
                          "city": "Fl 33126 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "2957651274210702438",
                          "houseNumber": "NW",
                          "streetName": "17TH NULL",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "NW 17TH NULL",
                          "addressLine2": "Fl 33126 Null",
                          "fullAddress": "NW 17TH NULL; Fl 33126 Null"
                      },
                      {
                          "city": "Ny 10956 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "1778900053374176000",
                          "houseNumber": "13",
                          "streetName": "NULL ESQUIRE NULL",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "NEW CITY",
                          "unitType": "Ste",
                          "addressLine1": "13 NULL ESQUIRE NULL, Ste NEW CITY",
                          "addressLine2": "Ny 10956 Null",
                          "fullAddress": "13 NULL ESQUIRE NULL, Ste NEW CITY; Ny 10956 Null"
                      },
                      {
                          "city": "Fl 33332 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "-7836607650404677321",
                          "houseNumber": "",
                          "streetName": "",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "",
                          "addressLine2": "Fl 33332 Null",
                          "fullAddress": "Fl 33332 Null"
                      },
                      {
                          "city": "Fl 33152 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "8006269354699913006",
                          "houseNumber": "NULL",
                          "streetName": "PO Box",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "Null",
                          "addressLine1": "PO Box NULL",
                          "addressLine2": "Fl 33152 Null",
                          "fullAddress": "PO Box NULL; Fl 33152 Null"
                      },
                      {
                          "city": "Jamaica",
                          "state": "NY",
                          "zip": "11434",
                          "county": "Queens",
                          "country": "",
                          "addressHash": "2651845322265799949",
                          "houseNumber": "15201",
                          "streetName": "Rockaway",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "15201 Rockaway",
                          "addressLine2": "Jamaica, NY 11434",
                          "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                      }
                  ]
              }
          ]
      },
      {
          "poseidonId": 7351427593366726082,
          "uccFilings": [],
          "newBusinessFilings": [],
          "usCorpFilings": [
              {
                  "poseidonId": 7351427593366726082,
                  "ein": "00-0000000",
                  "name": "INTERNATIONAL BONDED COURIERS INC",
                  "rawName": "INTERNATIONAL BONDED COURIERS, INC.",
                  "corpFileKey": "FL668892",
                  "corpStatus": "ACTIVE",
                  "corpStatusDate": "01/24/2023",
                  "corpType": "DOMESTIC FOR PROFIT",
                  "registryNumber": "668892",
                  "stateCode": "FL",
                  "statute": "",
                  "stateTaxId": "",
                  "term": "",
                  "fileData": null,
                  "fileDataDate": "4/21/2023",
                  "filingDate": "5/5/1980",
                  "incorporationState": "FL",
                  "filingType": "2023 ANNUAL REPORT",
                  "jurisdiction": "",
                  "lastReportedDate": "01/24/2023",
                  "expireDate": "",
                  "contacts": [],
                  "officers": [
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "6974824934531883459",
                              "nameFirst": "Morty",
                              "nameGender": "M",
                              "nameLast": "Langslow",
                              "nameMiddle": "",
                              "nameRaw": "MORTY LANGSLOW",
                              "nameProblemCodes": "NS01,NS05",
                              "nameHashOpt5": 2222942026644555431,
                              "namePrefix": "",
                              "nameHashOpt4": 8621776722250273825,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "CHAI",
                          "startDate": "20201107",
                          "status": null,
                          "address": {
                              "city": "Taipei Ti",
                              "state": "",
                              "zip": "",
                              "county": "",
                              "country": "",
                              "addressHash": "575705064156171430",
                              "houseNumber": "16-B",
                              "streetName": "ROME",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "16-B ROME",
                              "addressLine2": "Taipei Ti",
                              "fullAddress": "16-B ROME; Taipei Ti"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "2675655232442329976",
                              "nameFirst": "Alistair",
                              "nameGender": "M",
                              "nameLast": "Wood",
                              "nameMiddle": "M",
                              "nameRaw": "ALISTAIR M WOOD",
                              "nameProblemCodes": "NS01,NE05,NS05,NS06",
                              "nameHashOpt5": -6921399467051361564,
                              "namePrefix": "",
                              "nameHashOpt4": 8031665161012006344,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "DIRE,DIREC",
                          "startDate": "20201107",
                          "status": null,
                          "address": {
                              "city": "Taipei",
                              "state": "",
                              "zip": "",
                              "county": "",
                              "country": "",
                              "addressHash": "-629666956335798022",
                              "houseNumber": "16-B",
                              "streetName": "ROME",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "16-B ROME",
                              "addressLine2": "Taipei",
                              "fullAddress": "16-B ROME; Taipei"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "6767766236867752445",
                              "nameFirst": "Crai",
                              "nameGender": "M",
                              "nameLast": "Richard",
                              "nameMiddle": "",
                              "nameRaw": "CRAI RICHARD",
                              "nameProblemCodes": "NS01,NS05,NS06",
                              "nameHashOpt5": 7464649992458352169,
                              "namePrefix": "",
                              "nameHashOpt4": 7568305438132073023,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "REGISTERED AGENT,CFO",
                          "startDate": "20230501",
                          "status": null,
                          "address": {
                              "city": "Miami",
                              "state": "FL",
                              "zip": "33191",
                              "county": "Miami-Dade",
                              "country": "",
                              "addressHash": "-6898880467570785555",
                              "houseNumber": "8401",
                              "streetName": "17th",
                              "streetPostDirection": "",
                              "streetPreDirection": "NW",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "8401 NW 17th",
                              "addressLine2": "Miami, FL 33191",
                              "fullAddress": "8401 NW 17th; Miami, FL 33191"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "-5515158243905781463",
                              "nameFirst": "Langslow",
                              "nameGender": "U",
                              "nameLast": "Alex",
                              "nameMiddle": "",
                              "nameRaw": "LANGSLOW ALEX",
                              "nameProblemCodes": "NS01,NS06",
                              "nameHashOpt5": 616621012853148928,
                              "namePrefix": "",
                              "nameHashOpt4": 6252778289674577175,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "DIRE",
                          "startDate": "20230501",
                          "status": null,
                          "address": {
                              "city": "Hong Kong",
                              "state": "",
                              "zip": "",
                              "county": "",
                              "country": "",
                              "addressHash": "-1727616072286447034",
                              "houseNumber": "16B",
                              "streetName": "ROME",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "16B ROME",
                              "addressLine2": "Hong Kong",
                              "fullAddress": "16B ROME; Hong Kong"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": "",
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "8722164213855312689",
                              "nameFirst": "F",
                              "nameGender": "U",
                              "nameLast": "Costigan",
                              "nameMiddle": "",
                              "nameRaw": "F COSTIGAN",
                              "nameProblemCodes": "NS01,NS06",
                              "nameHashOpt5": -7104362347375432879,
                              "namePrefix": "",
                              "nameHashOpt4": -4655344729275058998,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "",
                          "startDate": "20160901",
                          "status": "",
                          "address": null,
                          "mailingAddress": null,
                          "fax": "30688872",
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "-8690369307214276728",
                              "nameFirst": "Joseph",
                              "nameGender": "M",
                              "nameLast": "Costigan Tmr",
                              "nameMiddle": "",
                              "nameRaw": "JOSEPH COSTIGAN TMR",
                              "nameProblemCodes": "NS01,NS05,NS06",
                              "nameHashOpt5": 7722708921848132767,
                              "namePrefix": "",
                              "nameHashOpt4": 5138465943074235818,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "CEO",
                          "startDate": "20201107",
                          "status": null,
                          "address": {
                              "city": "Jamaica",
                              "state": "NY",
                              "zip": "11434",
                              "county": "Queens",
                              "country": "",
                              "addressHash": "2651845322265799949",
                              "houseNumber": "15201",
                              "streetName": "Rockaway",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "15201 Rockaway",
                              "addressLine2": "Jamaica, NY 11434",
                              "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "-6758632371489273099",
                              "nameFirst": "Cooke",
                              "nameGender": "N",
                              "nameLast": "Chris",
                              "nameMiddle": "",
                              "nameRaw": "COOKE CHRIS",
                              "nameProblemCodes": "NS01,NS05,NS06",
                              "nameHashOpt5": 2725675777731245928,
                              "namePrefix": "",
                              "nameHashOpt4": 3190002681516144153,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "REGISTERED AGENT,GROU",
                          "startDate": "20201107",
                          "status": null,
                          "address": {
                              "city": "Miami",
                              "state": "FL",
                              "zip": "33191",
                              "county": "Miami-Dade",
                              "country": "",
                              "addressHash": "-6898880467570785555",
                              "houseNumber": "8401",
                              "streetName": "17th",
                              "streetPostDirection": "",
                              "streetPreDirection": "NW",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "8401 NW 17th",
                              "addressLine2": "Miami, FL 33191",
                              "fullAddress": "8401 NW 17th; Miami, FL 33191"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "-655415034962826221",
                              "nameFirst": "Simon",
                              "nameGender": "M",
                              "nameLast": "Higgs Mr",
                              "nameMiddle": "",
                              "nameRaw": "SIMON HIGGS MR",
                              "nameProblemCodes": "NS01,NS05,NS06",
                              "nameHashOpt5": -4686477020761102956,
                              "namePrefix": "",
                              "nameHashOpt4": 9123779054685223680,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "CEO",
                          "startDate": "20201107",
                          "status": null,
                          "address": {
                              "city": "Jamaica",
                              "state": "NY",
                              "zip": "11434",
                              "county": "Queens",
                              "country": "",
                              "addressHash": "2651845322265799949",
                              "houseNumber": "15201",
                              "streetName": "Rockaway",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "15201 Rockaway",
                              "addressLine2": "Jamaica, NY 11434",
                              "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "7321133153528876559",
                              "nameFirst": "Langslow",
                              "nameGender": "U",
                              "nameLast": "Morty",
                              "nameMiddle": "",
                              "nameRaw": "LANGSLOW MORTY",
                              "nameProblemCodes": "NS01",
                              "nameHashOpt5": 3093293742458351714,
                              "namePrefix": "",
                              "nameHashOpt4": -6687443867733744110,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "CHAI",
                          "startDate": "20230501",
                          "status": null,
                          "address": {
                              "city": "Hong Kong",
                              "state": "",
                              "zip": "",
                              "county": "",
                              "country": "",
                              "addressHash": "-1727616072286447034",
                              "houseNumber": "16B",
                              "streetName": "ROME",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "16B ROME",
                              "addressLine2": "Hong Kong",
                              "fullAddress": "16B ROME; Hong Kong"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "8722164213855312689",
                              "nameFirst": "Joseph",
                              "nameGender": "M",
                              "nameLast": "Costigan",
                              "nameMiddle": "T",
                              "nameRaw": "COSTIGAN JOSEPH T",
                              "nameProblemCodes": "NS01,NS05,NS06",
                              "nameHashOpt5": -2182924100697023145,
                              "namePrefix": "",
                              "nameHashOpt4": -6174434230441542346,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "CEO",
                          "startDate": "20230501",
                          "status": null,
                          "address": {
                              "city": "Jamaica",
                              "state": "NY",
                              "zip": "11434",
                              "county": "Queens",
                              "country": "",
                              "addressHash": "2651845322265799949",
                              "houseNumber": "15201",
                              "streetName": "Rockaway",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "15201 Rockaway",
                              "addressLine2": "Jamaica, NY 11434",
                              "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      }
                  ],
                  "phones": null,
                  "emails": [],
                  "stock": {
                      "stateCode": "",
                      "stockClass": "",
                      "stockDate": "",
                      "stockParValue": "",
                      "stockRestrictInd": "",
                      "stockSharesAuth": ""
                  },
                  "merger": {
                      "eventDescription": "",
                      "mergeDate": "",
                      "mergedCorpId": "",
                      "mergedCorpName": "",
                      "stateCode": "",
                      "survivingCorpId": ""
                  },
                  "history": {
                      "amendmentDate": "20230124",
                      "amendmentType": "ANNUAL REPORT",
                      "corpFileKey": "FL668892",
                      "historyEvent": null,
                      "stateCode": "FL"
                  },
                  "alternateName": {
                      "name": "",
                      "amendmentDate": "",
                      "certificationDate": "",
                      "consentName": "",
                      "corpFileKey": "",
                      "expireDate": "",
                      "filingDate": "",
                      "nameType": "",
                      "purpose": "",
                      "registryNumber": "",
                      "renewalDate": "",
                      "similarAltName": "",
                      "stateCode": "",
                      "stateOfOrigin": "",
                      "status": "",
                      "statusDate": "",
                      "xRef1Name": "",
                      "xRef2Name": ""
                  },
                  "corpMainAddresses": [
                      {
                          "city": "Jamaica",
                          "state": "NY",
                          "zip": "11434",
                          "county": "Queens",
                          "country": "",
                          "addressHash": "2651845322265799949",
                          "houseNumber": "15201",
                          "streetName": "Rockaway",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "15201 Rockaway",
                          "addressLine2": "Jamaica, NY 11434",
                          "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                      },
                      {
                          "city": "Jamaica",
                          "state": "NY",
                          "zip": "11435",
                          "county": "Queens",
                          "country": "",
                          "addressHash": "8620487858193709590",
                          "houseNumber": "14035",
                          "streetName": "Queens",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "14035 Queens",
                          "addressLine2": "Jamaica, NY 11435",
                          "fullAddress": "14035 Queens; Jamaica, NY 11435"
                      },
                      {
                          "city": "Ny 11042 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "6576889406387612763",
                          "houseNumber": "",
                          "streetName": "STE",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "New Hyde",
                          "addressLine1": "STE",
                          "addressLine2": "Ny 11042 Null",
                          "fullAddress": "STE; Ny 11042 Null"
                      },
                      {
                          "city": "Tx 78701 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "-8332944204220181098",
                          "houseNumber": "1050",
                          "streetName": "NULL BRAZOS NULL",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "AUSTIN",
                          "unitType": "Ste",
                          "addressLine1": "1050 NULL BRAZOS NULL, Ste AUSTIN",
                          "addressLine2": "Tx 78701 Null",
                          "fullAddress": "1050 NULL BRAZOS NULL, Ste AUSTIN; Tx 78701 Null"
                      },
                      {
                          "city": "Ny 11435 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "5443747082910272762",
                          "houseNumber": "",
                          "streetName": "NULL QUEENS NULL BOULEVARD NULL NULL JAMAICA",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "NULL QUEENS NULL BOULEVARD NULL NULL JAMAICA",
                          "addressLine2": "Ny 11435 Null",
                          "fullAddress": "NULL QUEENS NULL BOULEVARD NULL NULL JAMAICA; Ny 11435 Null"
                      },
                      {
                          "city": "Jamaica",
                          "state": "NY",
                          "zip": "11434",
                          "county": "Queens",
                          "country": "",
                          "addressHash": "2651845322265799949",
                          "houseNumber": "15201",
                          "streetName": "Rockaway",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "15201 Rockaway",
                          "addressLine2": "Jamaica, NY 11434",
                          "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                      },
                      {
                          "city": "Ny 11042 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "6576889406387612763",
                          "houseNumber": "",
                          "streetName": "STE",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "New Hyde",
                          "addressLine1": "STE",
                          "addressLine2": "Ny 11042 Null",
                          "fullAddress": "STE; Ny 11042 Null"
                      },
                      {
                          "city": "Fl 33126 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "2957651274210702438",
                          "houseNumber": "NW",
                          "streetName": "17TH NULL",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "NW 17TH NULL",
                          "addressLine2": "Fl 33126 Null",
                          "fullAddress": "NW 17TH NULL; Fl 33126 Null"
                      },
                      {
                          "city": "Ny 10956 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "1778900053374176000",
                          "houseNumber": "13",
                          "streetName": "NULL ESQUIRE NULL",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "NEW CITY",
                          "unitType": "Ste",
                          "addressLine1": "13 NULL ESQUIRE NULL, Ste NEW CITY",
                          "addressLine2": "Ny 10956 Null",
                          "fullAddress": "13 NULL ESQUIRE NULL, Ste NEW CITY; Ny 10956 Null"
                      },
                      {
                          "city": "Fl 33332 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "-7836607650404677321",
                          "houseNumber": "",
                          "streetName": "",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "",
                          "addressLine2": "Fl 33332 Null",
                          "fullAddress": "Fl 33332 Null"
                      },
                      {
                          "city": "Fl 33152 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "8006269354699913006",
                          "houseNumber": "NULL",
                          "streetName": "PO Box",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "Null",
                          "addressLine1": "PO Box NULL",
                          "addressLine2": "Fl 33152 Null",
                          "fullAddress": "PO Box NULL; Fl 33152 Null"
                      },
                      {
                          "city": "Jamaica",
                          "state": "NY",
                          "zip": "11434",
                          "county": "Queens",
                          "country": "",
                          "addressHash": "2651845322265799949",
                          "houseNumber": "15201",
                          "streetName": "Rockaway",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "15201 Rockaway",
                          "addressLine2": "Jamaica, NY 11434",
                          "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                      }
                  ]
              }
          ]
      },
      {
          "poseidonId": 8722974160778873605,
          "uccFilings": [],
          "newBusinessFilings": [],
          "usCorpFilings": [
              {
                  "poseidonId": 8722974160778873605,
                  "ein": "",
                  "name": "INTERNATIONAL BONDED COURIERS INC",
                  "rawName": "INTERNATIONAL BONDED COURIERS, INC.",
                  "corpFileKey": "NY1017651",
                  "corpStatus": "ACTIVE",
                  "corpStatusDate": "02/21/2022",
                  "corpType": "FOREIGN BUSINESS CORPORATION",
                  "registryNumber": "1017651",
                  "stateCode": "NY",
                  "statute": "",
                  "stateTaxId": "",
                  "term": "PERPETUAL",
                  "fileData": null,
                  "fileDataDate": "5/19/2023",
                  "filingDate": "8/9/1985",
                  "incorporationState": "",
                  "filingType": "BIENNIAL STATEMENT",
                  "jurisdiction": "FL",
                  "lastReportedDate": "",
                  "expireDate": "",
                  "contacts": [],
                  "officers": [
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": null,
                              "nameFirst": "",
                              "nameGender": "U",
                              "nameLast": "",
                              "nameMiddle": "",
                              "nameRaw": "C/O HOWARD MANN ATTY",
                              "nameProblemCodes": "NS01",
                              "nameHashOpt5": 0,
                              "namePrefix": "",
                              "nameHashOpt4": 0,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "PROCESSOR",
                          "startDate": "20201107",
                          "status": null,
                          "address": {
                              "city": "New City",
                              "state": "NY",
                              "zip": "10956",
                              "county": "Rockland",
                              "country": "",
                              "addressHash": "-8978566396447848310",
                              "houseNumber": "10",
                              "streetName": "Esquire",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "10 Esquire",
                              "addressLine2": "New City, NY 10956",
                              "fullAddress": "10 Esquire; New City, NY 10956"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "8722164213855312689",
                              "nameFirst": "Joseph",
                              "nameGender": "M",
                              "nameLast": "Costigan",
                              "nameMiddle": "F",
                              "nameRaw": "JOSEPH F COSTIGAN",
                              "nameProblemCodes": "NS01,NS05,NS06",
                              "nameHashOpt5": -7979037719456451024,
                              "namePrefix": "",
                              "nameHashOpt4": -8695878780235399942,
                              "nameSuffixNorm": "",
                              "tahoeId": "G8261360941320991846"
                          },
                          "title": "CHAIRMAN",
                          "startDate": "20201107",
                          "status": null,
                          "address": {
                              "city": "Doral",
                              "state": "FL",
                              "zip": "33126",
                              "county": "Miami-Dade",
                              "country": "",
                              "addressHash": "-1332885916633521794",
                              "houseNumber": "1771",
                              "streetName": "79th",
                              "streetPostDirection": "",
                              "streetPreDirection": "NW",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "1771 NW 79th",
                              "addressLine2": "Doral, FL 33126",
                              "fullAddress": "1771 NW 79th; Doral, FL 33126"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "461214708924601062",
                              "nameFirst": "Richard",
                              "nameGender": "M",
                              "nameLast": "Crai",
                              "nameMiddle": "",
                              "nameRaw": "RICHARD CRAI",
                              "nameProblemCodes": "NS01,NS05",
                              "nameHashOpt5": 2368970297284960450,
                              "namePrefix": "",
                              "nameHashOpt4": -338598189921246984,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "PROCESSOR",
                          "startDate": "20201107",
                          "status": null,
                          "address": {
                              "city": "Miami",
                              "state": "FL",
                              "zip": "33191",
                              "county": "Miami-Dade",
                              "country": "",
                              "addressHash": "-6898880467570785555",
                              "houseNumber": "8401",
                              "streetName": "17th",
                              "streetPostDirection": "",
                              "streetPreDirection": "NW",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "8401 NW 17th",
                              "addressLine2": "Miami, FL 33191",
                              "fullAddress": "8401 NW 17th; Miami, FL 33191"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "-8162728228316344038",
                              "nameFirst": "Simon",
                              "nameGender": "M",
                              "nameLast": "Higgs",
                              "nameMiddle": "",
                              "nameRaw": "SIMON HIGGS",
                              "nameProblemCodes": "NS01,NS05,NS06",
                              "nameHashOpt5": 788332595457292767,
                              "namePrefix": "",
                              "nameHashOpt4": 1024689275106781917,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "CHAIRMAN",
                          "startDate": "20201107",
                          "status": null,
                          "address": {
                              "city": "Jamaica",
                              "state": "NY",
                              "zip": "11434",
                              "county": "Queens",
                              "country": "",
                              "addressHash": "2651845322265799949",
                              "houseNumber": "15201",
                              "streetName": "Rockaway",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "15201 Rockaway",
                              "addressLine2": "Jamaica, NY 11434",
                              "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "4138911257331655682",
                              "nameFirst": "Joseph",
                              "nameGender": "M",
                              "nameLast": "Costigano",
                              "nameMiddle": "T",
                              "nameRaw": "JOSEPH T COSTIGANO",
                              "nameProblemCodes": "NS01,NS05",
                              "nameHashOpt5": 7450120029744405955,
                              "namePrefix": "",
                              "nameHashOpt4": 3865638893743640523,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "CHAIRMAN",
                          "startDate": "20201107",
                          "status": null,
                          "address": {
                              "city": "Jamaica",
                              "state": "NY",
                              "zip": "11434",
                              "county": "Queens",
                              "country": "",
                              "addressHash": "2651845322265799949",
                              "houseNumber": "15201",
                              "streetName": "Rockaway",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "15201 Rockaway",
                              "addressLine2": "Jamaica, NY 11434",
                              "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": "",
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "8722164213855312689",
                              "nameFirst": "F",
                              "nameGender": "U",
                              "nameLast": "Costigan",
                              "nameMiddle": "",
                              "nameRaw": "F COSTIGAN",
                              "nameProblemCodes": "NS01,NS06",
                              "nameHashOpt5": -7104362347375432879,
                              "namePrefix": "",
                              "nameHashOpt4": -4655344729275058998,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "",
                          "startDate": "20160901",
                          "status": "",
                          "address": null,
                          "mailingAddress": null,
                          "fax": "19332744",
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "760356148367489986",
                              "nameFirst": "Howard",
                              "nameGender": "M",
                              "nameLast": "Atty",
                              "nameMiddle": "Mann",
                              "nameRaw": "HOWARD MANN ATTY",
                              "nameProblemCodes": "NS01,NS05",
                              "nameHashOpt5": -1847833842310680297,
                              "namePrefix": "",
                              "nameHashOpt4": 4725142198647739459,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "PROCESSOR",
                          "startDate": "20201107",
                          "status": null,
                          "address": {
                              "city": "New City",
                              "state": "NY",
                              "zip": "10956",
                              "county": "Rockland",
                              "country": "",
                              "addressHash": "-8978566396447848310",
                              "houseNumber": "10",
                              "streetName": "Esquire",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "10 Esquire",
                              "addressLine2": "New City, NY 10956",
                              "fullAddress": "10 Esquire; New City, NY 10956"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      },
                      {
                          "fileDate": null,
                          "name": {
                              "nameSuffix": "",
                              "nameHashReq1": "8722164213855312689",
                              "nameFirst": "Joseph",
                              "nameGender": "M",
                              "nameLast": "Costigan",
                              "nameMiddle": "T",
                              "nameRaw": "JOSEPH T COSTIGAN",
                              "nameProblemCodes": "NS01,NS05,NS06",
                              "nameHashOpt5": -2182924100697023145,
                              "namePrefix": "",
                              "nameHashOpt4": -6174434230441542346,
                              "nameSuffixNorm": "",
                              "tahoeId": null
                          },
                          "title": "CHAIRMAN",
                          "startDate": "20201107",
                          "status": null,
                          "address": {
                              "city": "Jamaica",
                              "state": "NY",
                              "zip": "11434",
                              "county": "Queens",
                              "country": "",
                              "addressHash": "2651845322265799949",
                              "houseNumber": "15201",
                              "streetName": "Rockaway",
                              "streetPostDirection": "",
                              "streetPreDirection": "",
                              "unit": "",
                              "unitType": "",
                              "addressLine1": "15201 Rockaway",
                              "addressLine2": "Jamaica, NY 11434",
                              "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                          },
                          "mailingAddress": null,
                          "fax": null,
                          "email": null
                      }
                  ],
                  "phones": null,
                  "emails": [],
                  "stock": {
                      "stateCode": "",
                      "stockClass": "",
                      "stockDate": "",
                      "stockParValue": "",
                      "stockRestrictInd": "",
                      "stockSharesAuth": ""
                  },
                  "merger": {
                      "eventDescription": "",
                      "mergeDate": "",
                      "mergedCorpId": "",
                      "mergedCorpName": "",
                      "stateCode": "",
                      "survivingCorpId": ""
                  },
                  "history": {
                      "amendmentDate": "20220221",
                      "amendmentType": "MICROFILM NUMBER: 220221000815",
                      "corpFileKey": "NY1017651",
                      "historyEvent": "BIENNIAL STATEMENT",
                      "stateCode": "NY"
                  },
                  "alternateName": {
                      "name": "",
                      "amendmentDate": "",
                      "certificationDate": "",
                      "consentName": "",
                      "corpFileKey": "",
                      "expireDate": "",
                      "filingDate": "",
                      "nameType": "",
                      "purpose": "",
                      "registryNumber": "",
                      "renewalDate": "",
                      "similarAltName": "",
                      "stateCode": "",
                      "stateOfOrigin": "",
                      "status": "",
                      "statusDate": "",
                      "xRef1Name": "",
                      "xRef2Name": ""
                  },
                  "corpMainAddresses": [
                      {
                          "city": "Jamaica",
                          "state": "NY",
                          "zip": "11434",
                          "county": "Queens",
                          "country": "",
                          "addressHash": "2651845322265799949",
                          "houseNumber": "15201",
                          "streetName": "Rockaway",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "15201 Rockaway",
                          "addressLine2": "Jamaica, NY 11434",
                          "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                      },
                      {
                          "city": "Jamaica",
                          "state": "NY",
                          "zip": "11435",
                          "county": "Queens",
                          "country": "",
                          "addressHash": "8620487858193709590",
                          "houseNumber": "14035",
                          "streetName": "Queens",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "14035 Queens",
                          "addressLine2": "Jamaica, NY 11435",
                          "fullAddress": "14035 Queens; Jamaica, NY 11435"
                      },
                      {
                          "city": "Ny 11042 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "6576889406387612763",
                          "houseNumber": "",
                          "streetName": "STE",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "New Hyde",
                          "addressLine1": "STE",
                          "addressLine2": "Ny 11042 Null",
                          "fullAddress": "STE; Ny 11042 Null"
                      },
                      {
                          "city": "Tx 78701 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "-8332944204220181098",
                          "houseNumber": "1050",
                          "streetName": "NULL BRAZOS NULL",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "AUSTIN",
                          "unitType": "Ste",
                          "addressLine1": "1050 NULL BRAZOS NULL, Ste AUSTIN",
                          "addressLine2": "Tx 78701 Null",
                          "fullAddress": "1050 NULL BRAZOS NULL, Ste AUSTIN; Tx 78701 Null"
                      },
                      {
                          "city": "Ny 11435 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "5443747082910272762",
                          "houseNumber": "",
                          "streetName": "NULL QUEENS NULL BOULEVARD NULL NULL JAMAICA",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "NULL QUEENS NULL BOULEVARD NULL NULL JAMAICA",
                          "addressLine2": "Ny 11435 Null",
                          "fullAddress": "NULL QUEENS NULL BOULEVARD NULL NULL JAMAICA; Ny 11435 Null"
                      },
                      {
                          "city": "Jamaica",
                          "state": "NY",
                          "zip": "11434",
                          "county": "Queens",
                          "country": "",
                          "addressHash": "2651845322265799949",
                          "houseNumber": "15201",
                          "streetName": "Rockaway",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "15201 Rockaway",
                          "addressLine2": "Jamaica, NY 11434",
                          "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                      },
                      {
                          "city": "Ny 11042 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "6576889406387612763",
                          "houseNumber": "",
                          "streetName": "STE",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "New Hyde",
                          "addressLine1": "STE",
                          "addressLine2": "Ny 11042 Null",
                          "fullAddress": "STE; Ny 11042 Null"
                      },
                      {
                          "city": "Fl 33126 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "2957651274210702438",
                          "houseNumber": "NW",
                          "streetName": "17TH NULL",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "NW 17TH NULL",
                          "addressLine2": "Fl 33126 Null",
                          "fullAddress": "NW 17TH NULL; Fl 33126 Null"
                      },
                      {
                          "city": "Ny 10956 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "1778900053374176000",
                          "houseNumber": "13",
                          "streetName": "NULL ESQUIRE NULL",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "NEW CITY",
                          "unitType": "Ste",
                          "addressLine1": "13 NULL ESQUIRE NULL, Ste NEW CITY",
                          "addressLine2": "Ny 10956 Null",
                          "fullAddress": "13 NULL ESQUIRE NULL, Ste NEW CITY; Ny 10956 Null"
                      },
                      {
                          "city": "Fl 33332 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "-7836607650404677321",
                          "houseNumber": "",
                          "streetName": "",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "",
                          "addressLine2": "Fl 33332 Null",
                          "fullAddress": "Fl 33332 Null"
                      },
                      {
                          "city": "Fl 33152 Null",
                          "state": "",
                          "zip": "",
                          "county": "",
                          "country": "",
                          "addressHash": "8006269354699913006",
                          "houseNumber": "NULL",
                          "streetName": "PO Box",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "Null",
                          "addressLine1": "PO Box NULL",
                          "addressLine2": "Fl 33152 Null",
                          "fullAddress": "PO Box NULL; Fl 33152 Null"
                      },
                      {
                          "city": "Jamaica",
                          "state": "NY",
                          "zip": "11434",
                          "county": "Queens",
                          "country": "",
                          "addressHash": "2651845322265799949",
                          "houseNumber": "15201",
                          "streetName": "Rockaway",
                          "streetPostDirection": "",
                          "streetPreDirection": "",
                          "unit": "",
                          "unitType": "",
                          "addressLine1": "15201 Rockaway",
                          "addressLine2": "Jamaica, NY 11434",
                          "fullAddress": "15201 Rockaway; Jamaica, NY 11434"
                      }
                  ]
              }
          ]
      }
  ],
  "waterfallResult": false,
  "responseRecordCount": 6,
  "pagination": {
      "currentPageNumber": 1,
      "resultsPerPage": 10,
      "totalPages": 1,
      "totalResults": 0
  },
  "searchCriteria": [],
  "totalRequestExecutionTimeMs": 124,
  "requestId": "9a0f5531-1b85-4790-bfbf-42da13fcbfa2",
  "requestType": "",
  "requestTime": "2023-11-01T04:47:51.6144957-07:00",
  "isError": false,
  "error": {
      "inputErrors": [],
      "warnings": []
  }
};
//let x = collect_officers_from_eachbusinessSearch(test)
//console.log(x)

app.post('/gettingData', uploadFile.single('jsonFile'), (req, res) => {
  const filename = req.file.path;
  console.log("fileUploaded :📢📢📢 ", filename)
  fs.readFile(filename, 'utf8', (err, fileData) => {
    if (err) {
      console.error(`Error reading file: ${err}`);
      res.status(500).json('Error with reading file');
      return;
    }
    try {
      const jsonData = JSON.parse(fileData);
      const sortedArr = jsonData.sort((a, b) => a["Bureau Number"] - b["Bureau Number"]);
      const dataWithUniqueNames = sortedArr.map(element => ({
        ...element,
        "Primary Name": uniqueNames(element["Primary Name"])
      }));
      const finalFilteredCompanyData = removeDuplicatesAndFilter_ByState(dataWithUniqueNames)

      const finalFilteredCompanyDataString = JSON.stringify(finalFilteredCompanyData);
      const finalFilteredCompanyData_filePath = '_TestnewCollectedCompaniesData.json';
      console.log("filtred data start to save ....")
      saveDataInFS(finalFilteredCompanyData_filePath, finalFilteredCompanyDataString);


      console.log("filtred data ready for reading ....")
      readDataFromFS_ToAirTable(finalFilteredCompanyData_filePath, res);


    } catch (err) {
      console.error(`Error parsing JSON: ${err}`);
      res.status(500).json('Error >> parsing >> file');
    }
  });



  
});

app.listen(3000, () => {
  console.log("Welcome Form Server!");
});