const Airtable = require('airtable');
let YOUR_BASE_ID = "appYHqmzvMEe8d1fh"
let tabelIDofficers = "tblAvr3v29Ehi3CBY"
let tabelIDcompanies = "tblrL9VUF7YHRtaMQ"
let YOUR_API_KEY = "pat2ApjjayzWHglAu.59557439125e938beddd8eda07cd16cbf44788c351fc7b4704b7a6d9ddf392e1"

let finalObj={
    'Primary Names': [ 'BAYFRONT YOUTH & FAMILY SERVICES' ],
    CopyPasteURLs: [ null ],
    'Primary Name': 'BAYFRONT YOUTH & FAMILY SERVICES',
    City: 'LONG BEACH',
    State: 'CA',
    officers: [
      {
        PersonID: 'G8653280094009247393',
        FirstName: 'Winetta',
        LastName: 'Baker',
        Street: '6386 N Beechwood',
        City: 'San Bernardino',
        State: 'CA',
        postalCode: '92407',
        fullName: 'WINETTA A BAKER',
        Addresses: [Object],
        addressHash: '-8927290313294305469',
        startDate: '20220801'
      },
      {
        PersonID: 'G-447285716938497099',
        FirstName: 'Carlene',
        LastName: 'Fider',
        Street: '85 Tennessee, Apt B',
        City: 'Redlands',
        State: 'CA',
        postalCode: '92373',
        fullName: 'CARLENE OLIVIA FIDER',
        Addresses: [Object],
        addressHash: '-5122809264288252866',
        startDate: '20230731'
      },
      {
        PersonID: null,
        FirstName: 'Craig',
        LastName: 'Childress',
        Street: '2124 Bogie',
        City: 'La Verne',
        State: 'CA',
        postalCode: '91750',
        fullName: 'CRAIG CHILDRESS CHAIRMAN',
        Addresses: [Object],
        addressHash: '-1154145939062405627',
        startDate: '20220801'
      },
      {
        PersonID: null,
        FirstName: 'Maryam',
        LastName: 'Ribadu',
        Street: '490 W 14th',
        City: 'Long Beach',
        State: 'CA',
        postalCode: '90813',
        fullName: 'MARYAM RIBADU',
        Addresses: [Object],
        addressHash: '-2365829053128323721',
        startDate: '20220801'
      },
      {
        PersonID: null,
        FirstName: 'Maryam',
        LastName: 'Ribadu Jenkins',
        Street: '2703 N Studebaker',
        City: 'Long Beach',
        State: 'CA',
        postalCode: '90815',
        fullName: 'MARYAM RIBADU JENKINS',
        Addresses: [Object],
        addressHash: '-4582313799915829268',
        startDate: '20230731'
      }
    ]
  }
  function add_finalObj_inAirTable(finalObj) {
    console.log("From AirTable Endpoint finalObj");
    console.log(finalObj);
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
                let  testofficers = finalObj
                        .officers
                        .map((off)=>console.log(off));
                        console.log(testofficers);
                    const officers = finalObj
                        .officers
                        .map((officer) => ({
                            fields: {
                                'Person ID': officer['PersonID'],
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
                                    ?.phones[2],
                                'phone 4': officer['contactDetails']
                                    ?.phones[3],
                                'phone 5': officer['contactDetails']
                                    ?.phones[4],
                                'phone 6': officer['contactDetails']
                                    ?.phones[5],
                                'email 1': officer['contactDetails']
                                    ?.emails[0],
                                'email 2': officer['contactDetails']
                                    ?.emails[1],
                                'email 3': officer['contactDetails']
                                    ?.emails[2],
                                'email 4': officer['contactDetails']
                                    ?.emails[3],
                                'email 5': officer['contactDetails']
                                    ?.emails[4],
                                'email 6': officer['contactDetails']
                                    ?.emails[5],
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

            }
            console.log('Company  data only added 📢📢.');
        })
        .catch((err) => {
            console.error(err);
        });
};