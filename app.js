const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const fs = require('fs');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const util = require('util');
const Airtable = require('airtable');

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
  return resultArray;
};

const filterOfficersData = function (data) {
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
  const filteredResult = [];
  const uniqueFirstNames = {};
  for (const item of sortedResult) {
    let firstName = item.FirstName;
    let lastName = item.LastName;
    let nameKey = `${firstName} ${lastName}`
    if (!uniqueFirstNames[nameKey]) {
      uniqueFirstNames[nameKey] = true;
      filteredResult.push(item);
    }
  }
  return filteredResult;
};

const collect_officers_from_eachbusinessSearch = function (businessV2res) {

  //! here i collect only officers from each business searh
  let businessV2RecordsList = businessV2res.businessV2Records;
  let idsList_per_officer = [];
  if (businessV2RecordsList.length === 0) {
    console.log("empty response for business search")
    return []
  }
  for (let i = 0; i < businessV2RecordsList.length; i++) {
    let targetResObject = businessV2RecordsList[i];
    let target_usCorpFilings_list = targetResObject.usCorpFilings
    for (let j = 0; j < target_usCorpFilings_list.length; j++) {
      if (target_usCorpFilings_list.length >= 1) {
        let temp_officers_list_per_usCorpFilings = target_usCorpFilings_list[j].officers
        if (temp_officers_list_per_usCorpFilings.length === 0) {
          console.log("there is no officers in this res")
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
  return idsList_per_officer;
};

function collect_officers_from_NewResponse(newres) {
  let businessV2RecordsList = newres.businessV2Records;
  let officersList = []
  for (let i = 0; i < businessV2RecordsList.length; i++) {
    let newBusinessFilings = businessV2RecordsList[i].newBusinessFilings;
    for (let j = 0; j < newBusinessFilings.length; j++) {
      let contacts = newBusinessFilings[j].contacts
      let addresses = newBusinessFilings[j].addresses
      let tempOfficerObj = {};
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
        officersList.push(tempOfficerObj)
      }
    }
  }
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
  data.person.addresses.sort((a, b) => b.lastReportedDate - a.lastReportedDate);
  data.person.addresses = data.person.addresses.slice(0, 1);
  for (let i = 0; i < data.person.addresses.length; i++) {
    NewData.addresses.street = data.person.addresses[i].street;
    NewData.addresses.city = data.person.addresses[i].city;
    NewData.addresses.state = data.person.addresses[i].state;
    NewData.addresses.zip = data.person.addresses[i].zip;
  }
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
          officersList[i].contactDetails = filterEmails_Phones(response.data);
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
  const tabelIDofficers = 'tblKUidlysKdb3y0j';
  const tabelIDcompanies = 'tblBa05Kbq4DKt6bb';
  //! Clint
  // const YOUR_API_KEY = 'pat5Agjq0EkAWWhWz.ed5dc3086cdf35cc71c5b8d0fd7f75a03edce140385958ea527b4d18c63a3b12';
  // const YOUR_API_KEY = 'patSavjYsBOdkbgnU.ccda4116f516d8ed0620fb934afb552c34b7ecc28f6b1895fbf51470939fae31';
  const YOUR_API_KEY = 'pattzsOCwdz9aBKS2.9e129d222c8a8a3c387425be4fbc11987b80905765860c576d7151b360d32576';
  //! MSaad
  // const YOUR_API_KEY = 'patiSeXfa1Dl8vEas.0180e8500f631d1f22c3c8405ea91162139902ea3ff627c54bc01537604fe0d5';
  const base = new Airtable({ apiKey: YOUR_API_KEY }).base(YOUR_BASE_ID);
  const PrimaryNames = finalObj['Primary Names']
  const CopyPasteURLs = finalObj['CopyPasteURLs']
  // Concatenate the array elements into a single string with a delimiter
  const delimiter = ', ';
  const companyNames = PrimaryNames.join(delimiter);
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
  });
};

async function step2final_SearchContact(BusinessNames, res) {
  for (let i = 0; i < BusinessNames.length; i++) {
      setTimeout(async()=>{
        let tempObj = BusinessNames[i]
        tempObj.officers = []
        for (let x = 0; x < BusinessNames[i]["Primary Names"].length; x++) {          
          await new Promise((resolve) => setTimeout(resolve, 1000)); 
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
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error processing data' });
  }
};

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