import React, { useState } from 'react';
import {
    Screen,
    Stack,
    SearchBar,
    List,
    Text,
    Icon,
    Button,
} from '@shopify/ui-extensions-react/point-of-sale';
import { useExtensionSession } from '../../../shared/useExtensionSession';

const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
};
interface Customer {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
}
const SearchCustomerScreen = ({ host, api, setSearched, addCustomerToCart, extractCustomerId }) => {
    const [searchText, setSearchText] = useState('');
    const [customerData, setCustomerData] = useState<Customer[]>([]);
    const [isLoadings, setIsLoading] = useState(false);
    const [showNoResult, setShowNoResult] = useState(false);
    const [searchBarInstanceKey, setSearchBarInstanceKey] = useState(0);
    const { token} = useExtensionSession(api);

    const resetSearchState = () => {
        setSearchText('');
        setCustomerData([]);
        setShowNoResult(false);
        setIsLoading(false);
        // Force a fresh SearchBar instance so previous input text doesn't persist.
        setSearchBarInstanceKey((prev) => prev + 1);
    };

    const callsearch = async (text) => {
        setIsLoading(true);
        setSearchText(text)
        if (text.length === 0) {
            setCustomerData([]);
            setIsLoading(false);
            setShowNoResult(false)
            return;
        }
        const url = `${host}/pos/v1/customer/search?scanned=false`;
        try {
            const response = await fetch(url, {
                method: "POST",
                mode: "cors",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({ searchString: text }),
            });
            const data = await response.json();
            if (data.customers) {
                setCustomerData(data.customers);
                if (data.customers.length === 0) {
                    setShowNoResult(true);
                }
            } else {
                setCustomerData([]);
            }
        } catch (error) {
            api.toast.show(error, { duration: 3000 });
        } finally {
            setIsLoading(false);
        }
    }

    const debouncedSearch = debounce(callsearch, 300);

    const listData = customerData.map(customer => {
        const customerId = extractCustomerId(customer.id);
        return {
            id: customer.id,
            leftSide: {
                label: `${customer.firstName || ''} ${customer.lastName || ''}`,
                subtitle: [
                    { content: customer.email || '' },
                    { content: customer.phone || '' }
                ],
            },
            onPress: () => addCustomerToCart(customerId),
        };
    });

    const backToHome = () => {
        resetSearchState();
    }

    return (
        <Screen
            name="SearchCustomer"
            title="Search Customer"
            presentation={{ sheet: true }}
            onNavigate={resetSearchState}
            onNavigateBack={backToHome}
        >
            <Stack direction="inline" flexChildren paddingInline="450">
                <SearchBar
                    key={`search-customer-${searchBarInstanceKey}`}
                    onSearch={setSearched}
                    onTextChange={(text) => debouncedSearch(text)}
                    editable={true}
                    placeholder={'Scan or Search customers'}
                />
            </Stack>
            {isLoadings && <Button type={'plain'} title="" isLoading={isLoadings} />}
            {customerData.length > 0 &&
                <List title="" data={listData} />}
            {showNoResult &&
                <Stack direction="inline" justifyContent="center" gap="200" paddingBlock="500" alignItems="center" alignContent="center">
                    <Stack direction="inline" alignItems="center" alignContent="center">
                        <Icon name="circle-info" size="major" />
                    </Stack>
                    <Stack direction="inline" alignItems="center" alignContent="center">
                    <Text children={`No results found for "${searchText}"`}></Text>
                    </Stack>
                </Stack>
            }
        </Screen >
    );
};

export default SearchCustomerScreen;
