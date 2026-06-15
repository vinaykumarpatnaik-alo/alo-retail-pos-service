import React, { useContext, useEffect, useState } from "react";

import { WelcomeGift } from "./WelcomeGift";
import {
    useApi, useLocaleSubscription
} from '@shopify/ui-extensions-react/point-of-sale';
import { BirthdayGifts } from "./BirthdayGifts";
import { ExclusiveGifts } from "./ExclusiveGifts";
import { SelectionContext } from "../context/SelectionContext";
import ENjsonData from '../../../locales/en.json';
import FRcajsonData from '../../../locales/fr-ca.json';

export const Gifts = () => {
    const api = useApi();
    const { customerInfo, cartData } = useContext(SelectionContext);
    const [messages, setMessages] = useState<any>('');
    const locale = useLocaleSubscription();

    useEffect(() => {
        const fetchData = async () => {
            let response = await ENjsonData.main;
            if (locale.includes('fr-CA')) {
                response = await FRcajsonData.main;
            }
            setMessages(response)
        };
        fetchData();
    }, []);

    const extractEnableFlags = () => {
        let enableWelcomeGift = false;
        let enableExclusiveGift = false;
        let enableBirthdayGift = false;
        if (customerInfo?.enableFlags && customerInfo?.enableFlags?.length > 0) {
            for (let i = 0; i < customerInfo?.enableFlags?.length; i++) {
                const gitItem = customerInfo?.enableFlags[i];
                //api.toast.show(JSON.stringify(gitItem),{duration:3000})
                switch (gitItem?.id) {
                    case "Welcome Gift":
                        enableWelcomeGift = gitItem?.value;
                        break;
                    case "Exclusive Gift":
                        enableExclusiveGift = gitItem?.value;
                        break;
                    case "Birthday Gift":
                        enableBirthdayGift = gitItem?.value;
                        break;
                    default:
                        break;
                }
            }
        }
        return [enableWelcomeGift, enableExclusiveGift, enableBirthdayGift];
    };

    const [enableWelcomeGift, enableExclusiveGift, enableBirthdayGift] = extractEnableFlags();

    return (

        <>
            {enableWelcomeGift && (
                <WelcomeGift customerInfo={customerInfo} cartData={cartData} messages={messages} />
            )}
            {enableExclusiveGift && (
                <ExclusiveGifts customerInfo={customerInfo} cartData={cartData} messages={messages} />

            )}
            {enableBirthdayGift && (
                <BirthdayGifts customerInfo={customerInfo} cartData={cartData} messages={messages} />
            )}

        </>
    );
};

