const Airtable = require('airtable');
const axios = require('axios');
const filterController = require('./filterController');
const { json } = require('body-parser');

require('dotenv').config();
const galaxy_name = process.env.galaxy_name;
const galaxy_password = process.env.galaxy_password;
const YOUR_BASE_ID = process.env.YOUR_BASE_ID;
const tabelIDofficers = process.env.tabelIDofficers;
const tabelIDcompanies = process.env.tabelIDcompanies;
const YOUR_API_KEY = process.env.YOUR_API_KEY;

let BusinessV2SearchIndexCounter = 0;
let ContactEnrichIndex = 0;

function add_finalObj_inAirTable(finalObj) {
    //! MSaad: I check this finalObj comes right 
    const base = new Airtable({apiKey: YOUR_API_KEY}).base(YOUR_BASE_ID);
    const PrimaryNames = finalObj['Primary Names']
    const CopyPasteURLs = finalObj['CopyPasteURLs']
    // Concatenate the array elements into a single string with a delimiter
    const delimiter = ', ';
    const companyNames = PrimaryNames.join(delimiter);
    const CopyPasteURLsList = CopyPasteURLs.join(delimiter)
    base(tabelIDcompanies)
        .create([
            {
                fields: {
                    'result': finalObj['result'],
                    'Bureau Number': finalObj['Bureau Number'],
                    // 'Primary Name': finalObj['Primary Name'],
                    'Company Names': companyNames,
                    'Business Phones 1': finalObj['BusinessPhones'][0] || "No phone number provided",
                    'Business Phones 2': finalObj['BusinessPhones'][1] || "No phone number provided",
                    // 'File Name': finalObj['File Name'],
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
                }
            }
        ],)
        .then((records) => {
            console.log("finalObj.officers.length: " + finalObj.officers.length);
            console.log("finalObj.officer: ...");
            console.log(finalObj.officers);
            if (finalObj.officers.length > 0) {
                const officers = finalObj
                    .officers
                    .map((officer) => ({
                        fields: {
                            'Person ID': officer['PersonID'] || "No Person ID provided",
                            'First Name': officer['FirstName'],
                            'Last Name': officer['LastName'],
                            //'address': officer['Addresses'].addressLine2,
                            'Full Name': officer['fullName'],
                            // 'Street': officer['Street'], 'City': officer['City'], 'State':
                            // officer['State'], 'postal/zip code': officer['postalCode'],
                            'Street': officer['contactDetails']
                                ?.addresses
                                    ?.street,
                            'City': officer['contactDetails']
                                ?.addresses
                                    ?.city,
                            'State': officer['contactDetails']
                                ?.addresses
                                    ?.state,
                            'postal/zip code': officer['contactDetails']
                                ?.addresses
                                    ?.zip,
                            'phone 1': officer['contactDetails']
                                ?.phones[0],
                            'phone 2': officer['contactDetails']
                                ?.phones[1],
                            'phone 3': officer['contactDetails']
                                ?.phones[2] || "No phone number provided",
                            'phone 4': officer['contactDetails']
                                ?.phones[3] || "No phone number provided",
                            'phone 5': officer['contactDetails']
                                ?.phones[4] || "No phone number provided",
                            'phone 6': officer['contactDetails']
                                ?.phones[5] || "No phone number provided",
                            'email 1': officer['contactDetails']
                                ?.emails[0],
                            'email 2': officer['contactDetails']
                                ?.emails[1],
                            'email 3': officer['contactDetails']
                                ?.emails[2] || "No email provided",
                            'email 4': officer['contactDetails']
                                ?.emails[3] || "No email provided",
                            'email 5': officer['contactDetails']
                                ?.emails[4] || "No email provided",
                            'email 6': officer['contactDetails']
                                ?.emails[5] || "No email provided",
                            'company': [
                                records[0]
                                    ?.id
                            ], // Link officers to the company record
                        }
                    }));
                console.log("officer:...");
                console.log(officers);

                base(tabelIDofficers).create(officers, (officerErr) => {
                    if (officerErr) {
                        console.error("from adding data to airtable📢", officerErr);
                        //  return;
                    }
                });

                console.log('Company and Officer data added successfully.');
                console.log(
                    "BusinessV2SearchIndexCounter: " + BusinessV2SearchIndexCounter
                );
                BusinessV2SearchIndexCounter = 0;
                console.log("ContactEnrichIndex: " + ContactEnrichIndex);
                ContactEnrichIndex = 0;
            }
            console.log('Company  data only added 📢📢.');
        })
        .catch((err) => {
            console.error(err);
        });
};

//! 01-usCorpFilings
function collect_officers_from_eachbusinessSearch(businessV2res) {
    //! here i collect only officers from each business searh
    let businessV2RecordsList = businessV2res.businessV2Records;
    let officersList = [];
    let busPhones = [];
    if (businessV2RecordsList.length === 0) {
        console.log("empty response for business search")
        return []
    }
    console.log(
        "businessV2RecordsList.length: " + businessV2RecordsList.length
    );
    for (let i = 0; i < businessV2RecordsList.length; i++) {
        let AllBusPhones = businessV2RecordsList[i]
            ?.usCorpFilings
                ?.[0];
        if (AllBusPhones && AllBusPhones.phones !== null && AllBusPhones.phones !== undefined) {
            if (Array.isArray(AllBusPhones.phones) && AllBusPhones.phones.length !== 0) {
                console.log("phones: " + AllBusPhones.phones);
                busPhones.push(
                    AllBusPhones.phones[0]
                        ?.phoneNumber
                );
                if (AllBusPhones.phones[1]) {
                    busPhones.push(
                        AllBusPhones.phones[1]
                            ?.phoneNumber
                    );
                }

            }
        }
        console.log("busPhones: " + busPhones);
        let targetResObject = businessV2RecordsList[i];
        let target_usCorpFilings_list = targetResObject
            .usCorpFilings
            for (let j = 0; j < target_usCorpFilings_list.length; j++) {
                if (target_usCorpFilings_list.length >= 1) {
                    let temp_officers_list_per_usCorpFilings = target_usCorpFilings_list[j]
                        .officers
                        if (temp_officers_list_per_usCorpFilings.length === 0) {
                            console.log("there is no officers in this res")
                            return
                        }
                        console
                        .log(
                            "temp_officers_list_per_usCorpFilings.length: " +
                            temp_officers_list_per_usCorpFilings.length
                        );
                    for (let x = 0; x < temp_officers_list_per_usCorpFilings.length; x++) {
                        if (temp_officers_list_per_usCorpFilings.length >= 1) {
                            let target_officer_object = temp_officers_list_per_usCorpFilings[x];
                            //! for getting IDs
                            if (
                                target_officer_object
                                    ?.name
                            ) {
                                let tempObj = {
                                    "PersonID": target_officer_object
                                        ?.name
                                            ?.tahoeId,
                                    "FirstName": target_officer_object
                                        ?.name
                                            ?.nameFirst,
                                    "LastName": target_officer_object
                                        ?.name
                                            ?.nameLast,
                                    "Street": target_officer_object
                                        ?.address
                                            ?.addressLine1,
                                    "City": target_officer_object
                                        ?.address
                                            ?.city,
                                    "State": target_officer_object
                                        ?.address
                                            ?.state,
                                    "postalCode": target_officer_object
                                        ?.address
                                            ?.zip,
                                    "fullName": target_officer_object
                                        ?.name
                                            ?.nameRaw,
                                    "Addresses": {
                                        "addressLine2": `${target_officer_object
                                            ?.address
                                                ?.city}, ${target_officer_object
                                                    ?.address
                                                        ?.state}`
                                    },
                                    "addressHash": target_officer_object
                                        ?.address
                                            ?.addressHash,
                                    "startDate": target_officer_object
                                        ?.startDate

                                }
                                officersList.push(tempObj)
                            }
                        }
                    }
                }
            }
            console
            .log("End of businessV2RecordsList[" + i + "]");
    }
    console.log("officersList.len: " + officersList.length);
    return {officersList, busPhones};
};

//! 02-newBusinessFilings
function collect_officers_from_NewResponse(newres) {
    let businessV2RecordsList = newres.businessV2Records;
    let officersList = [];
    let busPhones = [];
    if (businessV2RecordsList.length === 0) {
        console.log("empty response for business search")
        return []
    }
    console.log(
        "businessV2RecordsList.length: " + businessV2RecordsList.length
    );
    for (let i = 0; i < businessV2RecordsList.length; i++) {
        let AllBusPhones = businessV2RecordsList[i]
            ?.newBusinessFilings
                ?.[0];

        // Check if AllBusPhones is not undefined and has the phones property
        if (AllBusPhones && AllBusPhones.phones !== null && AllBusPhones.phones !== undefined) {
            // Check if phones is an array and not empty
            if (Array.isArray(AllBusPhones.phones) && AllBusPhones.phones.length !== 0) {
                console.log("phones: " + AllBusPhones.phones);
                busPhones.push(
                    AllBusPhones.phones[0]
                        ?.phoneNumber
                );
                if (AllBusPhones.phones[1]) {
                    busPhones.push(
                        AllBusPhones.phones[1]
                            ?.phoneNumber
                    );
                }

            }
        }
        console.log("busPhones array after: " + busPhones);
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
                .filter(
                    (item) => item.addressTypeDesc.includes(tempOfficerObj['contactTypeDesc'])
                )
                .forEach((item) => {
                    tempOfficerObj['City'] = item.city;
                    tempOfficerObj['State'] = item.state;
                    tempOfficerObj['postalCode'] = item.zip;
                    tempOfficerObj['Street'] = item.addressLine1;
                    tempOfficerObj['addressTypeDesc'] = item.addressTypeDesc;
                    tempOfficerObj['Addresses'] = {
                        "addressLine2": `${item.city}, ${item.state}`
                    }
                });

            if (tempOfficerObj != {}) {
                officersList.push(tempOfficerObj)
            }
        }
        console.log("End of businessV2RecordsList[" + i + "]");
    }
    console.log("officersList.length: " + officersList.length);
    return {officersList, busPhones};
};

//! Search Contact Function by Id or Enrich
async function searchForContacts(officersListArr) {
    let officersList = officersListArr;
    console.log("Officer reached -searchForContacts- function successfully and their length is: " + officersList.length);
    console.log("my obj befor contact search", officersList);
    await(async function () {
        const promises = officersList.map(async (targetOfficer, i) => {
            return new Promise((resolve) => {
                setTimeout(async () => {
                    if (targetOfficer["PersonID"] !== null) {
                        try {
                            const response = await axios.request({
                                method: 'POST',
                                url: 'https://devapi.endato.com/Contact/Id',
                                headers: {
                                    accept: 'application/json',
                                    'galaxy-ap-name': galaxy_name,
                                    'galaxy-ap-password': galaxy_password,
                                    'galaxy-search-type': 'DevAPIContactID',
                                    'content-type': 'application/json',
                                    'galaxy-client-type': 'DevAPIContactEnrich'
                                },
                                data: {
                                    "PersonID": `${targetOfficer.PersonID}`
                                }
                            });
                            console.log("From Id officersList[" + i + "]: ", targetOfficer);
                            targetOfficer.contactDetails = await filterController.filterEmails_Phones(response.data);
                            console.log("officersList[" + i + "]: ", targetOfficer);
                        } catch (error) {
                            console.error("Error From SearchContact=> id search :", error.message);
                        };
                    } else {
                        try {
                            const response = await axios.request({
                                method: 'POST',
                                url: 'https://devapi.endato.com/Contact/Enrich',
                                headers: {
                                    accept: 'application/json',
                                    'galaxy-ap-name': galaxy_name,
                                    'galaxy-ap-password': galaxy_password,
                                    'galaxy-search-type': 'DevAPIContactEnrich',
                                    'content-type': 'application/json',
                                    'galaxy-client-type': 'DevAPIContactEnrich'
                                },
                                data: {
                                    "FirstName": `${targetOfficer['FirstName']}`,
                                    "LastName": `${targetOfficer['LastName']}`,
                                    "Address": {
                                        "addressLine2": `${targetOfficer.Addresses['addressLine2']}`
                                    }
                                }
                            });
                            console.log("From Enrich officersList[" + i + "]: ", targetOfficer);
                            targetOfficer.contactDetails = await filterController.filterEmails_Phones(response.data);
                            console.log("officersList[" + i + "]: ", targetOfficer);
                        } catch (error) {
                            console.error("Error From SearchContact => enrich search :", error.message);
                        };
                    }
                    resolve();
                }, i * 1000);
                ContactEnrichIndex += 1
            });
        });
        await Promise.all(promises);
    })();
    return officersList;
}

exports.step2final_SearchContact = async function (BusinessNames, res) {
    for (let i = 0; i < BusinessNames.length; i++) {
        setTimeout(async () => {
            console.log("BusinessNames[i]:... ")
            console.log(BusinessNames[i]);
            let tempObj = BusinessNames[i]
            tempObj.officers = []
            tempObj.BusinessPhones = []
            console.log("tempObj After empty Array: ")
            console.log(tempObj);
            for (let x = 0; x < BusinessNames[i]["Primary Names"].length; x++) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                try {
                    console.log(`😒😒😒bus started search ${x}`)
                    const response = await axios.request({
                        method: 'POST',
                        url: 'https://devapi.endato.com/BusinessV2Search',
                        headers: {
                            accept: 'application/json',
                            'galaxy-ap-name': galaxy_name,
                            'galaxy-ap-password': galaxy_password,
                            'galaxy-search-type': 'BusinessV2',
                            'content-type': 'application/json',
                            'galaxy-client-type': 'DevAPIContactEnrich'
                        },
                        data: {
                            "businessName": `${BusinessNames[i]["Primary Names"][x]}`,
                            "addressLine2": `${BusinessNames[i].City}, ${BusinessNames[i].State}`
                        }
                    })
                    console.log("😒😒😒bus end search and it's response length: " + response.data.businessV2Records.length);
                    BusinessV2SearchIndexCounter += 1;
                    if (response.data["businessV2Records"].length === 0) {
                        tempObj.result = `no business result for ${BusinessNames[i]["Primary Names"][x]} `;
                        console.log("🤦‍♂️🤦‍♂️", " empty [] in business search", tempObj);
                    } else {
                        let searchBusinssRes;
                        for (let z = 0; z < response.data["businessV2Records"].length; z++) {
                            if (
                                response.data["businessV2Records"][z]['newBusinessFilings']
                                    ?.length === 0
                            ) {
                                console.log(
                                    z + " - 📢📢📢usCorpFilings start ...."
                                )
                                searchBusinssRes = collect_officers_from_eachbusinessSearch(response.data)
                            }
                            if (
                                response.data["businessV2Records"][z]['usCorpFilings']
                                    ?.length === 0
                            ) {
                                console.log(
                                    z + " - 📢📢📢newBusinessFilings start ...."
                                )
                                searchBusinssRes = collect_officers_from_NewResponse(response.data)
                            }
                            console.log("searchBusinssRes.officersList.length: "+searchBusinssRes.officersList.length);
                            console.log("searchBusinssRes.busPhones is: "+searchBusinssRes.busPhones);
                            tempObj
                                .officers
                                .push(searchBusinssRes.officersList)
                                if (searchBusinssRes && searchBusinssRes.busPhones && Array.isArray(searchBusinssRes.busPhones) && searchBusinssRes.busPhones.length > 0) {
                                    console.log("busPhones is a non-empty array.");
                                    tempObj
                                        .BusinessPhones
                                        .push(...searchBusinssRes.busPhones)
                                }
                        }
                    }
                    console.log("📢📢📢📢📢📢📢📢📢 After adding officers tempObj is: ")
                    console.log(tempObj);
                } catch (error) {
                    console.error("Error From Search business function :", error.message);
                };
            }
            if (tempObj.officers.length > 0) {
                console.log("ther are officers !!! ... ")
                let OfficersDataList = [].concat(...tempObj.officers)
                OfficersDataList = filterController
                    .filterOfficersData(OfficersDataList)
                    .slice(0, 5)
                tempObj.officers = OfficersDataList;
                await searchForContacts(tempObj.officers)
                    .then((res) => {
                        console.log("res from searchForContacts in then response: ... ");
                        console.log(res);
                        tempObj.officers = res
                        console.log("FinalObj📢", tempObj)
                        //! MSaad: I check this and it's go to function right 
                        add_finalObj_inAirTable(tempObj)
                    })
                    .catch(err => {
                        console.log("err while we have officers for function of getting contacts", err.message)
                    })
                } else {
                tempObj.result = "There is no officers results ";
                console.log("😒😒 officers are empty array ... ")
                tempObj.officers = [];
                await searchForContacts(tempObj.officers)
                    .then((res) => {
                        tempObj.officers = res
                        console.log("FinalObj📢", tempObj)
                        //! MSaad: I check this and it's go to function right 
                        add_finalObj_inAirTable(tempObj)
                    })
                    .catch(err => {
                        console.log("err whilo no offices exist for new function of getting contacts", err.message)
                    })
                }
        }, i * 1000)
    }
    res
        .status(200)
        .json({message: 'Data processed successfully'});
};
