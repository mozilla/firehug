
function SearchCntl($scope, $http) {
	// initialize phonebook API key and app name.
	// NOTE: you have to go get your own API key and keep it private.

	// Initialize values for which fields of mozillians.org can be searched
	$scope.fieldNames = [ 'ircname', 'city', 'region', 'email', 'skills', 'languages', 'country', 'groups', 'name' ];
	$scope.searchField = 'city';
	$scope.searchString = 'brighton';
	$scope.searchedString = 'Look for some';
	$scope.peopleMet = [];

	// Initialize values for dynamic filtering of mozillians by summit location
	$scope.summitLocations = [ 'Santa Clara', 'Toronto', 'Brussels' ];
	$scope.summitLocation = 'Santa Clara';

	// Initialize the stem of all searches for this API key and app name
	// use JSONP to get around lack of CORS (see https://bugzilla.mozilla.org/show_bug.cgi?id=905672)
	// for API docs see https://wiki.mozilla.org/Mozillians/API-Specification/List_Users/

	// $scope.searchStem = 'https://mozillians.org/api/v1/users/?&limit=500&format=jsonp&callback=JSON_CALLBACK&app_name=' + $scope.appName + '&app_key=' + $scope.appKey;
	$scope.searchStem = '/realMozillians?client=angular';

	$scope.met = function (inPerson) {
		$scope.peopleMet.push(inPerson);
	}

	$scope.unmet = function (inIndex) {
		$scope.peopleMet.splice(inIndex, 1);
	}

	$scope.setSearchField = function(inString) {
		$scope.searchField = inString;
	}


	// Create search URL by combining stem with an array of key/value pairs representing HTTP GET arguments
	function getSearchURL(inParams) {
		var searchURL = $scope.searchStem;

		for (var paramName in inParams) {
			searchURL += '&' + paramName + '=' + inParams[paramName];
		}

		return searchURL;
	}

	// Initialize the summit location map
	// NOTE: this information is not public and is therefore withheld from this github repo.
	$scope.locationMap = locationMap();

	// Initialize the employee title map
	$scope.titleMap = titles();

	// Invoke the mozillians.org phonebook API, searching for people whose field has the specified value
	// Upon getting back results, add summit_location field using the global locationMap
	$scope.search = function(userName) {
		var params = {};
		params[$scope.searchField] = $scope.searchString;

    	$scope.searchURL = getSearchURL(params);
    	$scope.searchedString = 'Searching for '+ $scope.searchString + ' ' + $scope.searchField;

	  	$http.get($scope.searchURL).success(function(data) {
			console.log("SUCCESS " + data);

			$scope.searchedString = 'Found ' + data.meta.total_count + ' ' + $scope.searchString + ' ' + $scope.searchField;		
			$scope.people = data.objects;
			$scope.meta = data.meta;

			// pre-process the search results, adding summit locations where possible
			for (var i in $scope.people) {
				var person = $scope.people[i];

				if (person.email) {
					person.gravatar = 'http://www.gravatar.com/avatar/' + md5(person.email || '');
				}

				if ($scope.locationMap[person.full_name]) {
					person.summit_location = locationMap[person.full_name];
				} else {
					person.summit_location = 'Unknown';
				}

				if ($scope.titleMap[person.full_name]) {
					person.title = $scope.titleMap[person.full_name];
				} else {
					person.title = 'Mozillian';
				}
			}
		}).error(function(data) {
			console.log("FAIL");
			$scope.searchedString = 'Did not find ' + $scope.searchString + ' ' + $scope.searchField;					
			console.log(data);
		});    
	}
}
